// Ads use cases (SPEC "Annunci"): create Ad, add / regenerate Variant, save manual Version,
// discard / restore Variant, change Status and Location, queries. LLM calls are async and
// happen OUTSIDE transactions (bun:sqlite transactions must be synchronous); rows that belong
// together (a new Ad and its Variants, a Variant and its first Version) are written in one
// transaction afterwards.
import type { Database } from 'bun:sqlite'
import { findChannel, findChannelFormat, listChannelsWithFormats } from '../catalog/channel-catalog'
import { findJobOffer } from '../db/job-offers'
import type { Ad, AdLocation, JobOffer, Variant, Version } from '../domain/types'
import type { GeneratedVariantContent, GenerationService } from '../generation/generation-service'
import { AppError, badRequest, notFound, unprocessable } from '../http/errors'
import { LlmUnavailableError } from '../llm/llm-client'
import { validateContent } from '../validation/validate-content'
import * as repo from './ad-repository'
import { DEFAULT_ANGLE } from './angles'
import type {
  AdDetail,
  AdFilters,
  AdListItem,
  CreateAdInput,
  CreateAdResult,
  FailedAngle,
  UpdateAdInput,
  VariantWithCurrentVersion,
} from './types'

export interface AdUseCases {
  createAd(input: CreateAdInput): Promise<CreateAdResult>
  addVariant(adId: string, angle: string): Promise<VariantWithCurrentVersion>
  regenerateVariant(variantId: string): Promise<VariantWithCurrentVersion>
  saveManualVersion(variantId: string, content: unknown): VariantWithCurrentVersion
  setVariantActive(variantId: string, active: boolean): VariantWithCurrentVersion
  updateAd(adId: string, changes: UpdateAdInput): AdDetail
  listAds(filters: AdFilters): AdListItem[]
  getAd(adId: string): AdDetail
  listVersions(variantId: string): Version[]
}

/** Default Location: the Job Offer site as a public area ("Orzinuovi (BS)"), never the street. */
export function locationFromJobOffer(jobOffer: JobOffer): AdLocation {
  const site = jobOffer.payload.location
  return {
    label: `${site.locality} (${site.province_code})`,
    municipality: site.locality,
    province: site.province,
    provinceCode: site.province_code,
    region: site.region,
    country: site.country_code,
  }
}

const sameAngle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function createAdUseCases(deps: { db: Database; generation: GenerationService }): AdUseCases {
  const { db, generation } = deps

  const requireAd = (id: string): Ad => {
    const ad = repo.findAd(db, id)
    if (!ad) throw notFound('Annuncio non trovato.')
    return ad
  }

  /** Archived Ads are frozen: no new content and no Variant changes until the Status changes. */
  const requireEditableAd = (id: string): Ad => {
    const ad = requireAd(id)
    if (ad.status === 'archived') {
      throw unprocessable('AD_ARCHIVED', "L'Annuncio è archiviato: cambia lo Stato per modificarne le Varianti.", {
        adId: ad.id,
      })
    }
    return ad
  }

  const requireVariant = (id: string): Variant => {
    const variant = repo.findVariant(db, id)
    if (!variant) throw notFound('Variante non trovata.')
    return variant
  }

  const requireJobOffer = (id: string): JobOffer => {
    const jobOffer = findJobOffer(db, id)
    if (!jobOffer) throw notFound('Job Offer non trovata.')
    return jobOffer
  }

  const getAd = (adId: string): AdDetail => {
    const ad = requireAd(adId)
    return { ...ad, variants: repo.listVariantsWithCurrentVersion(db, ad.id) }
  }

  const variantView = (variantId: string): VariantWithCurrentVersion => {
    const variant = requireVariant(variantId)
    const found = repo.listVariantsWithCurrentVersion(db, variant.adId).find((v) => v.id === variant.id)
    if (!found) throw new Error(`Variant ${variant.id} has no Version`)
    return found
  }

  const llmProvenance = (generated: GeneratedVariantContent): repo.VersionProvenance => ({
    origin: 'llm',
    briefId: generated.briefId,
    model: generated.model,
    promptVersion: generated.promptVersion,
  })

  /** Throws 400 if another active Variant of the Ad (not `exceptVariantId`) already uses the angle. */
  const assertAngleFree = (adId: string, angle: string, exceptVariantId?: string) => {
    const taken = repo
      .listVariants(db, adId)
      .some((v) => v.active && v.id !== exceptVariantId && sameAngle(v.angle, angle))
    if (taken) throw badRequest(`L'Angolo "${angle}" è già usato da una Variante attiva di questo Annuncio.`, { angle })
  }

  /** Variant + its first Version, atomically: a Variant never exists without content. */
  const insertGeneratedVariant = (adId: string, angle: string, generated: GeneratedVariantContent) => {
    // Checked again here: a concurrent request may have taken the angle during the LLM call.
    assertAngleFree(adId, angle)
    const variant = repo.insertVariant(db, adId, angle)
    repo.insertVersion(db, variant.id, generated.content, llmProvenance(generated))
    return variant.id
  }
  const insertGeneratedVariantTx = db.transaction(insertGeneratedVariant)

  /** A new Ad and its generated Variants, atomically: an Ad is never stored without a Variant. */
  const insertAdWithVariants = db.transaction(
    (ad: Ad, variants: Array<{ angle: string; generated: GeneratedVariantContent }>) => {
      repo.saveAd(db, ad)
      for (const { angle, generated } of variants) insertGeneratedVariant(ad.id, angle, generated)
    },
  )

  return {
    async createAd(input) {
      const jobOffer = requireJobOffer(input.jobOfferId)
      if (!findChannelFormat(db, input.channelId, input.format)) {
        const channel = listChannelsWithFormats(db).find((c) => c.id === input.channelId)
        throw unprocessable(
          'CHANNEL_FORMAT_NOT_ALLOWED',
          channel
            ? `Il canale ${channel.name} non ammette il formato "${input.format}".`
            : `Il canale "${input.channelId}" non esiste.`,
          {
            channel: input.channelId,
            format: input.format,
            allowedFormats: channel?.formats.map((f) => f.format) ?? [],
          },
        )
      }

      const angles = (input.angles ?? [DEFAULT_ANGLE]).map((a) => a.trim())
      if (angles.some((a, i) => angles.findIndex((b) => sameAngle(a, b)) !== i)) {
        throw badRequest('Gli Angoli di un Annuncio devono essere diversi tra loro.', { angles })
      }

      // The Brief is shared by every angle: get it once up front so the parallel variant
      // generations reuse it. If this fails (LLM unavailable, invalid Brief) nothing is saved.
      await generation.getOrCreateBrief(jobOffer.id)

      // Generate first, store after: the Ad id tags the generation runs, but the Ad is saved
      // only if at least one angle succeeds. If every angle fails, the first error propagates.
      const ad = repo.newAd({
        jobOfferId: jobOffer.id,
        channelId: input.channelId,
        format: input.format,
        location: input.location ?? locationFromJobOffer(jobOffer),
      })

      const results = await Promise.allSettled(angles.map((angle) => generation.generateVariantContent({ ad, angle })))
      const succeeded: Array<{ angle: string; generated: GeneratedVariantContent }> = []
      const failedAngles: FailedAngle[] = []
      let firstError: unknown
      results.forEach((result, i) => {
        const angle = angles[i] ?? ''
        if (result.status === 'fulfilled') {
          succeeded.push({ angle, generated: result.value })
        } else {
          if (failedAngles.length === 0) firstError = result.reason
          failedAngles.push({ angle, error: toErrorBody(result.reason) })
        }
      })
      if (succeeded.length === 0) throw firstError
      insertAdWithVariants(ad, succeeded)
      return { ad: getAd(ad.id), failedAngles }
    },

    async addVariant(adId, rawAngle) {
      const ad = requireEditableAd(adId)
      const angle = rawAngle.trim()
      assertAngleFree(ad.id, angle)
      const generated = await generation.generateVariantContent({ ad, angle })
      return variantView(insertGeneratedVariantTx(ad.id, angle, generated))
    },

    async regenerateVariant(variantId) {
      const variant = requireVariant(variantId)
      const ad = requireEditableAd(variant.adId)
      const generated = await generation.generateVariantContent({ ad, angle: variant.angle })
      repo.insertVersion(db, variant.id, generated.content, llmProvenance(generated))
      return variantView(variant.id)
    },

    saveManualVersion(variantId, content) {
      const variant = requireVariant(variantId)
      const ad = requireEditableAd(variant.adId)
      const channel = findChannel(db, ad.channelId)
      const channelFormat = findChannelFormat(db, ad.channelId, ad.format)
      if (!channel || !channelFormat) throw new Error(`Ad ${ad.id}: channel format missing from the catalog`)
      const result = validateContent(content, { channel, channelFormat, jobOffer: requireJobOffer(ad.jobOfferId) })
      if (!result.ok) {
        throw unprocessable('INVALID_CONTENT', 'Il contenuto non rispetta i vincoli del canale.', {
          issues: result.issues,
        })
      }
      repo.insertVersion(db, variant.id, result.content, repo.MANUAL)
      return variantView(variant.id)
    },

    setVariantActive(variantId, active) {
      const variant = requireVariant(variantId)
      requireEditableAd(variant.adId)
      if (active) assertAngleFree(variant.adId, variant.angle, variant.id)
      repo.setVariantActive(db, variant.id, active)
      return variantView(variant.id)
    },

    updateAd(adId, changes) {
      const ad = requireAd(adId)
      if (changes.status === undefined && changes.location === undefined) {
        throw badRequest('Indica almeno uno tra status e location.')
      }
      // Status changes are otherwise free (the Team Delivery sets them by hand), but an Ad
      // cannot go live without content to show.
      if (changes.status === 'ready' || changes.status === 'published') {
        const hasActive = repo.listVariants(db, ad.id).some((v) => v.active)
        if (!hasActive) {
          throw unprocessable(
            'AD_HAS_NO_ACTIVE_VARIANT',
            "L'Annuncio non ha Varianti attive: ripristinane o aggiungine una prima di renderlo pronto o pubblicato.",
            { status: changes.status },
          )
        }
      }
      repo.updateAd(db, ad, {
        status: changes.status ?? ad.status,
        location: changes.location ?? ad.location,
      })
      return getAd(ad.id)
    },

    listAds: (filters) => repo.listAds(db, filters),

    getAd,

    listVersions(variantId) {
      return repo.listVersions(db, requireVariant(variantId).id)
    },
  }
}

/** Same body the API returns for that error, so a failed angle reads like a failed request. */
function toErrorBody(error: unknown): FailedAngle['error'] {
  if (error instanceof AppError) return { code: error.code, message: error.message, details: error.details }
  if (error instanceof LlmUnavailableError) return { code: 'LLM_UNAVAILABLE', message: error.message }
  console.error(error)
  return { code: 'INTERNAL', message: 'Errore interno del server.' }
}

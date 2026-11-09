// SQL for Ads, Variants and Versions. No deletes; Versions are insert-only (ADR 0002).
// Callers own transactions: functions here are single statements or plain reads.
import type { Database } from 'bun:sqlite'
import type { Ad, AdLocation, AdStatus, ChannelContent, Format, Variant, Version } from '../domain/types'
import { newId } from '../db/ids'
import { badRequest } from '../http/errors'
import type { AdFilters, AdListItem, VariantWithCurrentVersion } from './types'

const now = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

interface AdRow {
  id: string
  job_offer_id: string
  channel_id: string
  format: Format
  status: AdStatus
  location_label: string
  location_municipality: string | null
  location_province: string | null
  location_province_code: string | null
  location_region: string | null
  location_country: string
  created_at: string
  updated_at: string
}

const toAd = (row: AdRow): Ad => ({
  id: row.id,
  jobOfferId: row.job_offer_id,
  channelId: row.channel_id,
  format: row.format,
  status: row.status,
  location: {
    label: row.location_label,
    municipality: row.location_municipality,
    province: row.location_province,
    provinceCode: row.location_province_code,
    region: row.location_region,
    country: row.location_country,
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const locationParams = (location: AdLocation) => ({
  label: location.label,
  municipality: location.municipality,
  province: location.province,
  provinceCode: location.provinceCode,
  region: location.region,
  country: location.country,
})

/** New Ad in status draft. The composite FK rejects a Channel × Format not in channel_formats. */
export function insertAd(
  db: Database,
  input: { jobOfferId: string; channelId: string; format: Format; location: AdLocation },
): Ad {
  const timestamp = now()
  const ad: Ad = { id: newId('ad'), ...input, status: 'draft', createdAt: timestamp, updatedAt: timestamp }
  db.query(
    `INSERT INTO ads (id, job_offer_id, channel_id, format, status,
       location_label, location_municipality, location_province, location_province_code,
       location_region, location_country, created_at, updated_at)
     VALUES ($id, $jobOfferId, $channelId, $format, $status,
       $label, $municipality, $province, $provinceCode, $region, $country, $createdAt, $updatedAt)`,
  ).run({
    id: ad.id,
    jobOfferId: ad.jobOfferId,
    channelId: ad.channelId,
    format: ad.format,
    status: ad.status,
    ...locationParams(ad.location),
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
  })
  return ad
}

export function findAd(db: Database, id: string): Ad | null {
  const row = db.query('SELECT * FROM ads WHERE id = $id').get({ id }) as AdRow | null
  return row && toAd(row)
}

/** Filters are combined with AND; a missing filter matches everything. Newest first. */
export function listAds(db: Database, filters: AdFilters): AdListItem[] {
  const rows = db
    .query(
      `SELECT a.*,
         (SELECT COUNT(*) FROM variants v WHERE v.ad_id = a.id AND v.active = 1) AS active_variant_count
       FROM ads a
       WHERE ($jobOfferId IS NULL OR a.job_offer_id = $jobOfferId)
         AND ($channelId IS NULL OR a.channel_id = $channelId)
         AND ($status IS NULL OR a.status = $status)
       ORDER BY a.created_at DESC, a.id`,
    )
    .all({
      jobOfferId: filters.jobOfferId ?? null,
      channelId: filters.channelId ?? null,
      status: filters.status ?? null,
    }) as Array<AdRow & { active_variant_count: number }>
  return rows.map((row) => ({ ...toAd(row), activeVariantCount: row.active_variant_count }))
}

export function updateAd(db: Database, ad: Ad, changes: { status: AdStatus; location: AdLocation }): Ad {
  const updated: Ad = { ...ad, ...changes, updatedAt: now() }
  db.query(
    `UPDATE ads SET status = $status,
       location_label = $label, location_municipality = $municipality, location_province = $province,
       location_province_code = $provinceCode, location_region = $region, location_country = $country,
       updated_at = $updatedAt
     WHERE id = $id`,
  ).run({ id: ad.id, status: updated.status, ...locationParams(updated.location), updatedAt: updated.updatedAt })
  return updated
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

interface VariantRow {
  id: string
  ad_id: string
  label: string
  angle: string
  active: number
  created_at: string
}

const toVariant = (row: VariantRow): Variant => ({
  id: row.id,
  adId: row.ad_id,
  label: row.label,
  angle: row.angle,
  active: row.active === 1,
  createdAt: row.created_at,
})

const MAX_VARIANTS = 26 // labels A–Z

/** Next label of the Ad ("A", "B"…): Variants are never deleted, so the count is the next index. */
function nextVariantLabel(db: Database, adId: string): string {
  const { n } = db.query('SELECT COUNT(*) AS n FROM variants WHERE ad_id = $adId').get({ adId }) as { n: number }
  if (n >= MAX_VARIANTS) throw badRequest(`Un Annuncio può avere al massimo ${MAX_VARIANTS} Varianti.`)
  return String.fromCharCode(65 + n)
}

/** New active Variant with the next free label. Call inside the transaction that adds its first Version. */
export function insertVariant(db: Database, adId: string, angle: string): Variant {
  const variant: Variant = {
    id: newId('var'),
    adId,
    label: nextVariantLabel(db, adId),
    angle,
    active: true,
    createdAt: now(),
  }
  db.query(
    `INSERT INTO variants (id, ad_id, label, angle, active, created_at)
     VALUES ($id, $adId, $label, $angle, 1, $createdAt)`,
  ).run({ id: variant.id, adId, label: variant.label, angle, createdAt: variant.createdAt })
  return variant
}

export function findVariant(db: Database, id: string): Variant | null {
  const row = db.query('SELECT * FROM variants WHERE id = $id').get({ id }) as VariantRow | null
  return row && toVariant(row)
}

export function listVariants(db: Database, adId: string): Variant[] {
  const rows = db.query('SELECT * FROM variants WHERE ad_id = $adId ORDER BY label').all({ adId }) as VariantRow[]
  return rows.map(toVariant)
}

export function setVariantActive(db: Database, id: string, active: boolean): void {
  db.query('UPDATE variants SET active = $active WHERE id = $id').run({ id, active: active ? 1 : 0 })
}

// ---------------------------------------------------------------------------
// Versions (append-only; current = highest number)
// ---------------------------------------------------------------------------

/** Who produced a Version: LLM Versions carry their provenance, manual ones none. */
export type VersionProvenance =
  | { origin: 'llm'; briefId: string; model: string; promptVersion: string }
  | { origin: 'manual'; briefId: null; model: null; promptVersion: null }

export const MANUAL: VersionProvenance = { origin: 'manual', briefId: null, model: null, promptVersion: null }

interface VersionRow {
  id: string
  variant_id: string
  number: number
  content: string
  origin: 'llm' | 'manual'
  brief_id: string | null
  model: string | null
  prompt_version: string | null
  created_at: string
}

function toVersion(row: VersionRow): Version {
  const base = {
    id: row.id,
    variantId: row.variant_id,
    number: row.number,
    content: JSON.parse(row.content) as ChannelContent,
    createdAt: row.created_at,
  }
  if (row.origin === 'manual') return { ...base, ...MANUAL }
  // The versions CHECK constraint guarantees provenance on llm rows.
  if (row.brief_id === null || row.model === null || row.prompt_version === null) {
    throw new Error(`Version ${row.id}: llm origin without provenance`)
  }
  return { ...base, origin: 'llm', briefId: row.brief_id, model: row.model, promptVersion: row.prompt_version }
}

/** Appends Version number = current + 1. Call inside a transaction with any related writes. */
export function insertVersion(
  db: Database,
  variantId: string,
  content: ChannelContent,
  provenance: VersionProvenance,
): Version {
  const { next } = db
    .query('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM versions WHERE variant_id = $variantId')
    .get({ variantId }) as { next: number }
  const version: Version = { id: newId('ver'), variantId, number: next, content, createdAt: now(), ...provenance }
  db.query(
    `INSERT INTO versions (id, variant_id, number, content, origin, brief_id, model, prompt_version, created_at)
     VALUES ($id, $variantId, $number, $content, $origin, $briefId, $model, $promptVersion, $createdAt)`,
  ).run({
    id: version.id,
    variantId,
    number: version.number,
    content: JSON.stringify(content),
    origin: provenance.origin,
    briefId: provenance.briefId,
    model: provenance.model,
    promptVersion: provenance.promptVersion,
    createdAt: version.createdAt,
  })
  return version
}

/** Newest first. */
export function listVersions(db: Database, variantId: string): Version[] {
  const rows = db
    .query('SELECT * FROM versions WHERE variant_id = $variantId ORDER BY number DESC')
    .all({ variantId }) as VersionRow[]
  return rows.map(toVersion)
}

/** Variants of the Ad (by label), each with its current (highest-numbered) Version. */
export function listVariantsWithCurrentVersion(db: Database, adId: string): VariantWithCurrentVersion[] {
  const rows = db
    .query(
      `SELECT ver.* FROM versions ver
       JOIN variants v ON v.id = ver.variant_id
       WHERE v.ad_id = $adId
         AND ver.number = (SELECT MAX(number) FROM versions WHERE variant_id = ver.variant_id)`,
    )
    .all({ adId }) as VersionRow[]
  const current = new Map(rows.map((row) => [row.variant_id, toVersion(row)]))
  // A Variant is always inserted together with its first Version, so every one has a current Version.
  return listVariants(db, adId).flatMap((variant) => {
    const currentVersion = current.get(variant.id)
    return currentVersion ? [{ ...variant, currentVersion }] : []
  })
}

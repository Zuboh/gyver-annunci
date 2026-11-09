// Ads: list (filters), detail, create (one Variant per angle), Status/Location change, new Variant.
// Request bodies use the SPEC field names (job_offer_id, channel); responses use domain types.
import type { Static } from '@sinclair/typebox'
import { Elysia, t } from 'elysia'
import type { AdUseCases } from '../ads/ad-use-cases'
import { AD_STATUSES, FORMATS, type AdLocation } from '../domain/types'

// Not t.UnionEnum: inside t.Optional it injects its first value as a default (Elysia 1.4.31),
// so an omitted `status` would silently become 'draft'.
const literalUnion = <T extends string>(values: readonly T[]) => t.Union(values.map((value) => t.Literal(value)))
const statusSchema = literalUnion(AD_STATUSES)

const nonBlank = (maxLength: number) => t.String({ minLength: 1, maxLength, pattern: '\\S' })
const nullableString = t.Optional(t.Union([t.String(), t.Null()]))

const locationBody = t.Object({
  label: nonBlank(80),
  municipality: nullableString,
  province: nullableString,
  provinceCode: t.Optional(t.Union([t.String({ minLength: 2, maxLength: 2 }), t.Null()])),
  region: nullableString,
  country: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
})

/** A Location in the body replaces the whole Location: omitted geographic fields become null. */
const toLocation = (body: Static<typeof locationBody>): AdLocation => ({
  label: body.label.trim(),
  municipality: body.municipality ?? null,
  province: body.province ?? null,
  provinceCode: body.provinceCode ?? null,
  region: body.region ?? null,
  country: body.country ?? 'IT',
})

const angleBody = nonBlank(60)

export function adsRoutes(ads: AdUseCases) {
  return new Elysia()
    .get(
      '/api/ads',
      ({ query }) => ads.listAds({ jobOfferId: query.job_offer_id, channelId: query.channel, status: query.status }),
      {
        query: t.Object({
          job_offer_id: t.Optional(t.String()),
          channel: t.Optional(t.String()),
          status: t.Optional(statusSchema),
        }),
      },
    )
    .get('/api/ads/:id', ({ params }) => ads.getAd(params.id))
    // 201 even when some angles failed: the Ad exists; `failedAngles` lists what to retry.
    .post(
      '/api/ads',
      async ({ body, status }) =>
        status(
          201,
          await ads.createAd({
            jobOfferId: body.job_offer_id,
            channelId: body.channel,
            format: body.format,
            location: body.location && toLocation(body.location),
            angles: body.angles,
          }),
        ),
      {
        body: t.Object({
          job_offer_id: t.String({ minLength: 1 }),
          channel: t.String({ minLength: 1 }),
          format: literalUnion(FORMATS),
          location: t.Optional(locationBody),
          angles: t.Optional(t.Array(angleBody, { minItems: 1, maxItems: 3 })),
        }),
      },
    )
    .patch(
      '/api/ads/:id',
      ({ params, body }) =>
        ads.updateAd(params.id, { status: body.status, location: body.location && toLocation(body.location) }),
      {
        body: t.Object({
          status: t.Optional(statusSchema),
          location: t.Optional(locationBody),
        }),
      },
    )
    .post(
      '/api/ads/:id/variants',
      async ({ params, body, status }) => status(201, await ads.addVariant(params.id, body.angle)),
      { body: t.Object({ angle: angleBody }) },
    )
}

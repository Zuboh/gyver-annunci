// Variants: Version history, LLM regeneration, manual Version, discard / restore.
import { Elysia, t } from 'elysia'
import type { AdUseCases } from '../ads/ad-use-cases'

export function variantsRoutes(ads: AdUseCases) {
  return new Elysia()
    .get('/api/variants/:id/versions', ({ params }) => ads.listVersions(params.id))
    .post('/api/variants/:id/regenerate', async ({ params, status }) =>
      status(201, await ads.regenerateVariant(params.id)),
    )
    // The content shape depends on the Ad's channel kind: validateContent checks it (422 with issues).
    .put(
      '/api/variants/:id/content',
      ({ params, body, status }) => status(201, ads.saveManualVersion(params.id, body.content)),
      { body: t.Object({ content: t.Unknown() }) },
    )
    .patch('/api/variants/:id', ({ params, body }) => ads.setVariantActive(params.id, body.active), {
      body: t.Object({ active: t.Boolean() }),
    })
}

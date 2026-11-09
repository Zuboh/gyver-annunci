// Job Offers (read-only input) and their Brief.
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { findJobOffer, listJobOffers } from '../db/job-offers'
import type { JobOffer } from '../domain/types'
import { findCurrentBrief, type GenerationService } from '../generation/generation-service'
import { notFound } from './errors'

export function jobOffersRoutes(deps: { db: Database; generation: GenerationService }) {
  const { db, generation } = deps
  const requireJobOffer = (id: string): JobOffer => {
    const jobOffer = findJobOffer(db, id)
    if (!jobOffer) throw notFound('Job Offer non trovata.')
    return jobOffer
  }

  return (
    new Elysia()
      .get('/api/job-offers', () => listJobOffers(db))
      // Current Brief included, null until the first generation.
      .get('/api/job-offers/:id', ({ params }) => {
        const jobOffer = requireJobOffer(params.id)
        return { ...jobOffer, brief: findCurrentBrief(db, jobOffer.id) }
      })
      // Regenerates the Brief: appends a new one, which becomes the current Brief.
      .post('/api/job-offers/:id/brief', async ({ params, status }) => {
        const jobOffer = requireJobOffer(params.id)
        return status(201, await generation.getOrCreateBrief(jobOffer.id, { force: true }))
      })
  )
}

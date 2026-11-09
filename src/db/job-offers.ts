// Job Offers: external, read-only input. Only queries live here; the seed inserts jo_001.
import type { Database } from 'bun:sqlite'
import type { JobOffer, JobOfferPayload, JobOfferSummary } from '../domain/types'

interface JobOfferRow {
  id: string
  title: string
  company_name: string
  status: string
  payload: string
}

const toJobOffer = (row: JobOfferRow): JobOffer => ({
  id: row.id,
  title: row.title,
  companyName: row.company_name,
  status: row.status,
  payload: JSON.parse(row.payload) as JobOfferPayload,
})

export function findJobOffer(db: Database, id: string): JobOffer | null {
  const row = db.query('SELECT * FROM job_offers WHERE id = $id').get({ id }) as JobOfferRow | null
  return row && toJobOffer(row)
}

/** Summaries only: the payload holds internal data and is served by the detail endpoint alone. */
export function listJobOffers(db: Database): JobOfferSummary[] {
  return db
    .query('SELECT id, title, company_name AS companyName, status FROM job_offers ORDER BY id')
    .all() as JobOfferSummary[]
}

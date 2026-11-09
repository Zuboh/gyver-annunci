// Job Offers: external, read-only input. Only queries live here; the seed inserts jo_001.
import type { Database } from 'bun:sqlite'
import type { JobOffer, JobOfferPayload } from '../domain/types'

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

export function listJobOffers(db: Database): JobOffer[] {
  const rows = db.query('SELECT * FROM job_offers ORDER BY id').all() as JobOfferRow[]
  return rows.map(toJobOffer)
}

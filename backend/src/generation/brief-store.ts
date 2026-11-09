// Briefs table: append-only, the most recent Brief of a Job Offer is the one in use.
import type { Database } from 'bun:sqlite'
import { newId } from '../db/ids'
import type { Brief, BriefContent } from '../domain/types'

interface BriefRow {
  id: string
  job_offer_id: string
  content: string
  model: string
  prompt_version: string
  created_at: string
}

const toBrief = (row: BriefRow): Brief => ({
  id: row.id,
  jobOfferId: row.job_offer_id,
  content: JSON.parse(row.content) as BriefContent,
  model: row.model,
  promptVersion: row.prompt_version,
  createdAt: row.created_at,
})

/** Current Brief = most recent. rowid breaks ties between briefs created in the same millisecond. */
export function findCurrentBrief(db: Database, jobOfferId: string): Brief | null {
  const row = db
    .query<BriefRow, { jobOfferId: string }>(
      `SELECT id, job_offer_id, content, model, prompt_version, created_at
       FROM briefs WHERE job_offer_id = $jobOfferId
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get({ jobOfferId })
  return row ? toBrief(row) : null
}

export function insertBrief(
  db: Database,
  input: { jobOfferId: string; content: BriefContent; model: string; promptVersion: string },
): Brief {
  const brief: Brief = { id: newId('brief'), createdAt: new Date().toISOString(), ...input }
  db.query(
    `INSERT INTO briefs (id, job_offer_id, content, model, prompt_version, created_at)
     VALUES ($id, $jobOfferId, $content, $model, $promptVersion, $createdAt)`,
  ).run({
    id: brief.id,
    jobOfferId: brief.jobOfferId,
    content: JSON.stringify(brief.content),
    model: brief.model,
    promptVersion: brief.promptVersion,
    createdAt: brief.createdAt,
  })
  return brief
}

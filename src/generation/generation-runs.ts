// generation_runs table: one row per LLM attempt, kept even when nothing else is saved.
import type { Database } from 'bun:sqlite'
import { newId } from '../db/ids'
import type { ContentIssue, GenerationKind, GenerationOutcome } from '../domain/types'

export interface NewGenerationRun {
  kind: GenerationKind
  /** kind "brief" → job offer id; kind "variant" → ad id. */
  ref: string
  attempt: number
  outcome: GenerationOutcome
  issues: ContentIssue[]
  rawResponse: string | null
}

/** Inserts the run and returns its id. */
export function recordRun(db: Database, run: NewGenerationRun): string {
  const id = newId('run')
  db.query(
    `INSERT INTO generation_runs (id, kind, ref, attempt, outcome, issues, raw_response, created_at)
     VALUES ($id, $kind, $ref, $attempt, $outcome, $issues, $rawResponse, $createdAt)`,
  ).run({
    id,
    kind: run.kind,
    ref: run.ref,
    attempt: run.attempt,
    outcome: run.outcome,
    issues: JSON.stringify(run.issues),
    rawResponse: run.rawResponse,
    createdAt: new Date().toISOString(),
  })
  return id
}

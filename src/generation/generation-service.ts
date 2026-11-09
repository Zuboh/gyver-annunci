// Generation: orchestrates Brief (reuse or create) → Variant content → validation → one retry.
// CONTRACT ONLY in this step; implemented by a later step.
import type { Database } from 'bun:sqlite'
import type { Ad, Brief, ChannelContent } from '../domain/types'
import type { LlmClient } from '../llm/llm-client'

export interface GeneratedVariantContent {
  /** Validated content (passed validateContent), ready to be stored as an `llm` Version. */
  content: ChannelContent
  briefId: string
  model: string
  promptVersion: string
}

/**
 * Responsibilities:
 * - Inserts one generation_runs row for EVERY LLM attempt (outcome ok | invalid | error),
 *   kind "brief" with ref = jobOfferId, kind "variant" with ref = ad.id.
 * - Validates LLM output with validateContent; on invalid output retries once, passing the
 *   issues as `previousIssues`.
 * - Persists Briefs (append-only; the latest per Job Offer is the one in use).
 * - Does NOT write ads, variants or versions: the Ads use cases persist those.
 *
 * Errors:
 * - AppError 404 NOT_FOUND: Job Offer (or the Ad's channel format) does not exist.
 * - AppError 502 GENERATION_FAILED via generationFailed(runId): still invalid after the retry;
 *   runId = id of the last generation_runs row.
 * - AppError 503 LLM_UNAVAILABLE via llmUnavailable(): the LlmClient threw LlmUnavailableError
 *   (the attempt is recorded with outcome "error" before rethrowing).
 */
export interface GenerationService {
  /** Latest Brief of the Job Offer, generating it if none exists or if `force` is true. */
  getOrCreateBrief(jobOfferId: string, opts?: { force?: boolean }): Promise<Brief>
  /** Content for a new Version of a Variant of `ad` with the given angle. Uses getOrCreateBrief. */
  generateVariantContent(input: { ad: Ad; angle: string }): Promise<GeneratedVariantContent>
}

export function createGenerationService(deps: { db: Database; llm: LlmClient }): GenerationService {
  const notImplemented = async (): Promise<never> => {
    throw new Error('GenerationService not implemented yet')
  }
  return { getOrCreateBrief: notImplemented, generateVariantContent: notImplemented }
}

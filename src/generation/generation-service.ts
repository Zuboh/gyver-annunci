// Generation: orchestrates Brief (reuse or create) → Variant content → validation → one retry.
import type { Database } from 'bun:sqlite'
import { z } from 'zod'
import { findChannel, findChannelFormat } from '../catalog/channel-catalog'
import { findJobOffer } from '../db/job-offers'
import { briefContentSchema } from '../domain/brief-schema'
import type {
  Ad,
  Brief,
  BriefContent,
  ChannelContent,
  ContentIssue,
  GenerationKind,
} from '../domain/types'
import { generationFailed, llmUnavailable, notFound } from '../http/errors'
import { LlmUnavailableError, type LlmClient, type LlmResult } from '../llm/llm-client'
import { validateContent } from '../validation/validate-content'
import { findCurrentBrief, insertBrief } from './brief-store'
import { recordRun } from './generation-runs'

export { findCurrentBrief } from './brief-store'

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
 *   kind "brief" with ref = jobOfferId, kind "variant" with ref = ad.id. `attempt` restarts at 1
 *   on every call (1 = first try, 2 = the single retry).
 * - Validates LLM output (briefContentSchema for Briefs, validateContent for Variant content);
 *   on invalid output retries once. Variant retries get the issues as `previousIssues`; Brief
 *   retries are plain (GenerateBriefInput has no feedback channel).
 * - Persists Briefs (append-only; the latest per Job Offer is the one in use).
 * - Does NOT write ads, variants or versions: the Ads use cases persist those.
 *
 * Errors:
 * - AppError 404 NOT_FOUND: Job Offer, Channel or Channel Format does not exist.
 * - AppError 502 GENERATION_FAILED via generationFailed(runId): still invalid after the retry;
 *   runId = id of the last generation_runs row.
 * - AppError 503 LLM_UNAVAILABLE via llmUnavailable(): the LlmClient threw LlmUnavailableError
 *   (the attempt is recorded with outcome "error" before rethrowing). Any other thrown error
 *   is recorded the same way and rethrown untouched.
 */
export interface GenerationService {
  /** Latest Brief of the Job Offer, generating it if none exists or if `force` is true. */
  getOrCreateBrief(jobOfferId: string, opts?: { force?: boolean }): Promise<Brief>
  /** Content for a new Version of a Variant of `ad` with the given angle. Uses getOrCreateBrief. */
  generateVariantContent(input: { ad: Ad; angle: string }): Promise<GeneratedVariantContent>
}

const MAX_ATTEMPTS = 2

const NO_CONTENT_ISSUE: ContentIssue = {
  path: '',
  message: 'Il modello non ha restituito un contenuto strutturato (rifiuto o risposta incompleta).',
}

type Checked<T> = { ok: true; content: T } | { ok: false; issues: ContentIssue[] }

const italianErrors = z.locales.it().localeError

function checkBrief(content: unknown): Checked<BriefContent> {
  const parsed = briefContentSchema.safeParse(content, { error: italianErrors })
  if (parsed.success) return { ok: true, content: parsed.data }
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  }
}

export function createGenerationService(deps: { db: Database; llm: LlmClient }): GenerationService {
  const { db, llm } = deps
  /** In-flight Brief creations, so parallel Variant generations of one Job Offer share one Brief. */
  const pendingBriefs = new Map<string, Promise<Brief>>()

  /** Calls the LLM up to MAX_ATTEMPTS times, recording each attempt in generation_runs. */
  async function withRetry<T>(
    kind: GenerationKind,
    ref: string,
    call: (previousIssues: ContentIssue[] | undefined) => Promise<LlmResult<unknown>>,
    check: (content: unknown) => Checked<T>,
  ): Promise<{ content: T; model: string; promptVersion: string }> {
    let previousIssues: ContentIssue[] | undefined
    let lastRunId = ''
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let result: LlmResult<unknown>
      try {
        result = await call(previousIssues)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        recordRun(db, { kind, ref, attempt, outcome: 'error', issues: [{ path: '', message }], rawResponse: null })
        if (err instanceof LlmUnavailableError) throw llmUnavailable(err.message)
        throw err
      }
      const checked: Checked<T> =
        result.content === null ? { ok: false, issues: [NO_CONTENT_ISSUE] } : check(result.content)
      if (checked.ok) {
        recordRun(db, { kind, ref, attempt, outcome: 'ok', issues: [], rawResponse: result.raw })
        return { content: checked.content, model: result.model, promptVersion: result.promptVersion }
      }
      lastRunId = recordRun(db, {
        kind,
        ref,
        attempt,
        outcome: 'invalid',
        issues: checked.issues,
        rawResponse: result.raw,
      })
      previousIssues = checked.issues
    }
    throw generationFailed(lastRunId)
  }

  async function createBrief(jobOfferId: string): Promise<Brief> {
    const jobOffer = findJobOffer(db, jobOfferId)
    if (!jobOffer) throw notFound(`Job Offer ${jobOfferId} non trovata.`)
    const generated = await withRetry('brief', jobOfferId, () => llm.generateBrief({ jobOffer }), checkBrief)
    return insertBrief(db, { jobOfferId, ...generated })
  }

  async function getOrCreateBrief(jobOfferId: string, opts: { force?: boolean } = {}): Promise<Brief> {
    if (!opts.force) {
      const current = findCurrentBrief(db, jobOfferId)
      if (current) return current
      const pending = pendingBriefs.get(jobOfferId)
      if (pending) return pending
    }
    const creation = createBrief(jobOfferId).finally(() => pendingBriefs.delete(jobOfferId))
    pendingBriefs.set(jobOfferId, creation)
    return creation
  }

  async function generateVariantContent({ ad, angle }: { ad: Ad; angle: string }): Promise<GeneratedVariantContent> {
    const jobOffer = findJobOffer(db, ad.jobOfferId)
    if (!jobOffer) throw notFound(`Job Offer ${ad.jobOfferId} non trovata.`)
    const channel = findChannel(db, ad.channelId)
    if (!channel) throw notFound(`Canale ${ad.channelId} non trovato.`)
    const channelFormat = findChannelFormat(db, ad.channelId, ad.format)
    if (!channelFormat) throw notFound(`Formato ${ad.format} non disponibile per il canale ${ad.channelId}.`)
    const brief = await getOrCreateBrief(ad.jobOfferId)

    const generated = await withRetry(
      'variant',
      ad.id,
      (previousIssues) =>
        llm.generateVariantContent({
          brief: brief.content,
          channel,
          channelFormat,
          angle,
          location: ad.location,
          ...(previousIssues && { previousIssues }),
        }),
      (content): Checked<ChannelContent> => {
        const result = validateContent(content, { channel, channelFormat, jobOffer, origin: 'llm' })
        return result.ok ? result : { ok: false, issues: result.issues }
      },
    )
    return { ...generated, briefId: brief.id }
  }

  return { getOrCreateBrief, generateVariantContent }
}

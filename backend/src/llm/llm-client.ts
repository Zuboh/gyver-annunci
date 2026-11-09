// LlmClient: the single substitution point of the system (real OpenAI client vs test fake).
// It only talks to the model: no DB access, no validation of business rules, no retries
// on invalid content (the generation service owns retry and generation_runs).
import type {
  AdLocation,
  BriefContent,
  Channel,
  ChannelFormat,
  ContentIssue,
  JobOffer,
} from '../domain/types'

export interface LlmResult<T> {
  content: T
  /** Raw response text, stored in generation_runs.raw_response. */
  raw: string
  model: string
  promptVersion: string
}

export interface GenerateBriefInput {
  jobOffer: JobOffer
}

export interface GenerateVariantContentInput {
  /** Never the raw Job Offer (ADR 0003): channel prompts only see the Brief. */
  brief: BriefContent
  channel: Channel
  channelFormat: ChannelFormat
  angle: string
  location: AdLocation
  /** Issues from the previous invalid attempt, so the retry can fix them. */
  previousIssues?: ContentIssue[]
}

export interface LlmClient {
  generateBrief(input: GenerateBriefInput): Promise<LlmResult<BriefContent>>
  /** Content is `unknown` on purpose: the caller must run validateContent on it. */
  generateVariantContent(input: GenerateVariantContentInput): Promise<LlmResult<unknown>>
}

/**
 * The model cannot be used: missing API key, network failure, timeout, rate limit,
 * provider outage. Mapped to HTTP 503 (code LLM_UNAVAILABLE). `message` is Italian.
 */
export class LlmUnavailableError extends Error {
  override name = 'LlmUnavailableError'
}

/** Client used when no API key is configured: every call fails with LlmUnavailableError. */
export function createUnavailableLlmClient(message: string): LlmClient {
  const fail = async (): Promise<never> => {
    throw new LlmUnavailableError(message)
  }
  return { generateBrief: fail, generateVariantContent: fail }
}

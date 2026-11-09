// OpenAI implementation of LlmClient: Chat Completions with strict structured outputs.
//
// The response is requested with zodResponseFormat (the strict JSON Schema is enforced by
// OpenAI) but parsed here with JSON.parse instead of `chat.completions.parse`: the SDK's parse
// throws on a schema mismatch and the raw text would be lost. This way every output reaches
// the generation service, which validates it, stores `raw` in generation_runs and retries.
//
// Errors:
// - no API key, network failure/timeout, 401/403, unknown model (404), 429, 5xx
//   → LlmUnavailableError (HTTP 503). The key is checked at call time, so the server starts without it.
// - refusal, truncated output (finish_reason "length"/"content_filter"), non-JSON text
//   → returned with `content: null` and the text in `raw`: it fails validation downstream
//   and is recorded as an "invalid" attempt (then retried once).
// - anything else (e.g. 400 from a schema bug) is rethrown untouched.
import OpenAI, {
  APIConnectionError,
  AuthenticationError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import { briefContentSchema, type BriefContent } from '../domain/brief-schema'
import { contentSchemaFor } from '../domain/content-schemas'
import { LlmUnavailableError, type LlmClient, type LlmResult } from './llm-client'
import { briefPrompt, variantPromptFor, type PromptMessages } from './prompts'

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 1

export function createOpenAiLlmClient(opts: { apiKey?: string; model?: string }): LlmClient {
  const model = opts.model ?? DEFAULT_OPENAI_MODEL
  const apiKey = opts.apiKey
  // Passing apiKey explicitly: the SDK would otherwise fall back to process.env on its own.
  const client = apiKey
    ? new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES })
    : null

  async function complete(
    schema: z.ZodType,
    schemaName: string,
    messages: PromptMessages,
    promptVersion: string,
  ): Promise<LlmResult<unknown>> {
    if (!client) throw new LlmUnavailableError('La chiave OPENAI_API_KEY non è configurata.')
    let completion: OpenAI.ChatCompletion
    try {
      completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
        response_format: zodResponseFormat(schema, schemaName),
      })
    } catch (err) {
      throw toUnavailable(err) ?? err
    }

    const choice = completion.choices[0]
    const message = choice?.message
    const base = { model: completion.model, promptVersion }
    if (!message || message.refusal) {
      return { ...base, content: null, raw: message?.refusal ?? '' }
    }
    const raw = message.content ?? ''
    if (choice.finish_reason !== 'stop') return { ...base, content: null, raw }
    return { ...base, content: parseJson(raw), raw }
  }

  return {
    async generateBrief(input) {
      const result = await complete(
        briefContentSchema,
        'brief',
        briefPrompt.build(input),
        briefPrompt.version,
      )
      // Shape enforced by strict structured outputs; the generation service re-validates it.
      return result as LlmResult<BriefContent>
    },
    async generateVariantContent(input) {
      const prompt = variantPromptFor(input.channel.kind)
      return complete(
        contentSchemaFor(input.channel.kind),
        `${input.channel.kind}_content`,
        prompt.build(input),
        prompt.version,
      )
    },
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Maps SDK errors meaning "the model cannot be used right now" to LlmUnavailableError. */
function toUnavailable(err: unknown): LlmUnavailableError | null {
  // APIConnectionTimeoutError extends APIConnectionError.
  if (err instanceof APIConnectionError) {
    return new LlmUnavailableError('Il servizio OpenAI non è raggiungibile o non ha risposto in tempo.')
  }
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new LlmUnavailableError('La chiave OpenAI non è valida o non ha i permessi necessari.')
  }
  if (err instanceof NotFoundError) {
    return new LlmUnavailableError('Il modello OpenAI configurato non esiste o non è disponibile.')
  }
  if (err instanceof RateLimitError) {
    return new LlmUnavailableError('Limite di richieste OpenAI raggiunto: riprova tra poco.')
  }
  if (err instanceof InternalServerError) {
    return new LlmUnavailableError('Il servizio OpenAI è temporaneamente non disponibile.')
  }
  return null
}

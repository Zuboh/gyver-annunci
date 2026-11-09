// Application errors. Thrown anywhere (use cases, services, routes) and turned by the
// app's onError into `{ error: { code, message, details? } }`. Messages are Italian.

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  /** 422: Channel × Format not in channel_formats. */
  | 'CHANNEL_FORMAT_NOT_ALLOWED'
  /** 422: manual content fails validation; details = { issues: ContentIssue[] }. */
  | 'INVALID_CONTENT'
  /** 502: LLM output still invalid after the retry; details = { runId }. */
  | 'GENERATION_FAILED'
  /** 503: no API key, network error, timeout. */
  | 'LLM_UNAVAILABLE'
  | 'INTERNAL'

export class AppError extends Error {
  override name = 'AppError'

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message)

export const unprocessable = (
  code: 'CHANNEL_FORMAT_NOT_ALLOWED' | 'INVALID_CONTENT',
  message: string,
  details?: unknown,
) => new AppError(422, code, message, details)

export const generationFailed = (runId: string) =>
  new AppError(
    502,
    'GENERATION_FAILED',
    'La generazione non ha prodotto un contenuto valido dopo il nuovo tentativo.',
    { runId },
  )

export const llmUnavailable = (message = 'Il servizio LLM non è configurato o non è raggiungibile.') =>
  new AppError(503, 'LLM_UNAVAILABLE', message)

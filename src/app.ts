// HTTP app factory: the single test seam (SPEC "Testing Decisions"). Tests build it with an
// in-memory DB and a FakeLlmClient and call app.handle(request) directly.
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import type { ContentIssue } from './domain/types'
import { AppError, type ErrorCode } from './http/errors'
import { LlmUnavailableError, type LlmClient } from './llm/llm-client'

export interface AppDeps {
  db: Database
  llm: LlmClient
}

const errorBody = (code: ErrorCode, message: string, details?: unknown) => ({
  error: { code, message, details },
})

/** Elysia validation path "/location/label" → ContentIssue path "location.label". */
const toIssuePath = (path: string) => path.replace(/^\//, '').replaceAll('/', '.')

/** `deps` is consumed by the route modules plugged in below. */
export function createApp(deps: AppDeps) {
  return (
    new Elysia()
      // Registered before any route so it covers every route and every plugin used below.
      // AppError is matched with instanceof first: Elysia copies a thrown error's own `code`
      // property into the hook's `code`, so `code` alone cannot tell our errors apart.
      .onError(({ code, error, set }) => {
        if (error instanceof AppError) {
          set.status = error.status
          return errorBody(error.code, error.message, error.details)
        }
        if (error instanceof LlmUnavailableError) {
          set.status = 503
          return errorBody('LLM_UNAVAILABLE', error.message)
        }
        switch (code) {
          case 'VALIDATION': {
            set.status = 400
            const issues: ContentIssue[] = error.all.map((e) => ({
              path: toIssuePath(e.path),
              message: e.message,
            }))
            return errorBody('BAD_REQUEST', 'Richiesta non valida.', { issues })
          }
          case 'PARSE':
            set.status = 400
            return errorBody('BAD_REQUEST', 'Il corpo della richiesta non è leggibile.')
          case 'NOT_FOUND':
            set.status = 404
            return errorBody('NOT_FOUND', 'Risorsa non trovata.')
          default:
            console.error(error)
            set.status = 500
            return errorBody('INTERNAL', 'Errore interno del server.')
        }
      })
      .get('/api/health', () => ({ status: 'ok' }))
    // Route modules plug in here, one per area, as functions of the deps returning an Elysia
    // instance with full paths, e.g. `.use(jobOffersRoutes(deps))`, `.use(adsRoutes(deps))`.
    // Static UI: `.get('/', file('public/index.html'))` + staticPlugin with a `/public` prefix;
    // never `indexHTML: true`, which would turn API 404s into HTML.
  )
}

export type App = ReturnType<typeof createApp>

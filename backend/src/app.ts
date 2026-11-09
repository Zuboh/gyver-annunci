// HTTP app factory: the single test seam (SPEC "Testing Decisions"). Tests build it with an
// in-memory DB and a FakeLlmClient and call app.handle(request) directly.
import type { Database } from 'bun:sqlite'
import { fileURLToPath } from 'node:url'
import { staticPlugin } from '@elysia/static'
import { Elysia } from 'elysia'
import { createAdUseCases } from './ads/ad-use-cases'
import type { ContentIssue } from './domain/types'
import { createGenerationService } from './generation/generation-service'
import { adsRoutes } from './http/ads-routes'
import { channelsRoutes } from './http/channels-routes'
import { AppError, type ErrorCode } from './http/errors'
import { jobOffersRoutes } from './http/job-offers-routes'
import { variantsRoutes } from './http/variants-routes'
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

/** Resolved from this file, so the app serves the UI whatever the working directory. */
const frontendDir = fileURLToPath(new URL('../../frontend', import.meta.url))

export function createApp(deps: AppDeps) {
  const generation = createGenerationService(deps)
  const ads = createAdUseCases({ db: deps.db, generation })
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
      // Route modules: one per area, each an Elysia instance with full paths.
      .use(jobOffersRoutes({ db: deps.db, generation }))
      .use(channelsRoutes({ db: deps.db }))
      .use(adsRoutes(ads))
      .use(variantsRoutes(ads))
      // Static UI: index on `/`, assets under `/assets`. Never `indexHTML: true`, which would
      // turn API 404s into HTML. A handler (not `file()`) so the file is read on every request:
      // `file()` is compiled into a static response with the Content-Length of startup time.
      .get('/', () => Bun.file(`${frontendDir}/index.html`))
      .use(staticPlugin({ assets: frontendDir, prefix: '/assets' }))
  )
}

export type App = ReturnType<typeof createApp>

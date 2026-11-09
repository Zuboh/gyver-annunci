// Single test seam (SPEC "Testing Decisions"): the real app on an in-memory seeded DB with a
// programmable FakeLlmClient. Tests only talk HTTP via app.handle: no ports, no network.
import { createApp } from '../src/app'
import { openDatabase } from '../src/db/open-database'
import { seed } from '../src/db/seed'
import { FakeLlmClient, type FakeLlmScript } from '../src/llm/fake-llm-client'

export interface ApiResponse {
  status: number
  // Response bodies are JSON of varying shape; tests read only the fields they assert on.
  body: any
}

export function setup(script: FakeLlmScript = {}) {
  const db = openDatabase(':memory:')
  seed(db)
  const fake = new FakeLlmClient(script)
  const app = createApp({ db, llm: fake })

  const call = async (method: string, path: string, body?: unknown): Promise<ApiResponse> => {
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    return { status: res.status, body: await res.json() }
  }

  const api = {
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    put: (path: string, body: unknown) => call('PUT', path, body),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
  }

  /** The seeded (PDF example) Ad of a channel, with its Variants and current Versions. */
  const seededAd = async (channel: 'indeed' | 'instagram' | 'whatsapp') => {
    const list = await api.get(`/api/ads?channel=${channel}`)
    const detail = await api.get(`/api/ads/${list.body[0].id}`)
    return detail.body
  }

  return { api, fake, seededAd }
}

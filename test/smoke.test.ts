import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app'
import { openDatabase } from '../src/db/open-database'
import { FakeLlmClient } from '../src/llm/fake-llm-client'

const app = createApp({ db: openDatabase(':memory:'), llm: new FakeLlmClient() })

describe('smoke', () => {
  test('GET /api/health → 200', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('unknown route → 404 with the uniform error shape', async () => {
    const res = await app.handle(new Request('http://localhost/api/nope'))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Risorsa non trovata.' } })
  })
})

import { describe, expect, test } from 'bun:test'
import { invalidContent, socialContentWithStreetAddress } from '../src/llm/fake-llm-client'
import { LlmUnavailableError } from '../src/llm/llm-client'
import { setup } from './helpers'

describe('retry and generation failures', () => {
  test('invalid then valid → Version saved, the retry received the previous issues', async () => {
    const { api, fake, seededAd } = setup({ variants: [{ content: invalidContent }] })
    const variant = (await seededAd('indeed')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(201)
    expect(res.body.currentVersion.number).toBe(2)

    const [first, retry] = fake.calls.generateVariantContent
    expect(first?.previousIssues).toBeUndefined()
    expect(retry?.previousIssues?.map((i) => i.path)).toContain('title')
  })

  test('always invalid → 502 GENERATION_FAILED with runId, no Version saved', async () => {
    const { api, fake, seededAd } = setup({ variantFallback: { content: invalidContent } })
    const variant = (await seededAd('indeed')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(502)
    expect(res.body.error).toMatchObject({ code: 'GENERATION_FAILED', details: { runId: expect.any(String) } })
    expect(fake.calls.generateVariantContent).toHaveLength(2)
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })

  test('always invalid on a new Variant → 502, no Variant added', async () => {
    const { api, seededAd } = setup({ variantFallback: { content: invalidContent } })
    const ad = await seededAd('indeed')
    const res = await api.post(`/api/ads/${ad.id}/variants`, { angle: 'stipendio' })
    expect(res.status).toBe(502)
    expect((await api.get(`/api/ads/${ad.id}`)).body.variants).toHaveLength(1)
  })

  test('network error → 503 LLM_UNAVAILABLE, no Version saved', async () => {
    const { api, seededAd } = setup({ variantFallback: { throws: new LlmUnavailableError('Rete non raggiungibile.') } })
    const variant = (await seededAd('indeed')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('LLM_UNAVAILABLE')
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })

  test('LLM unavailable while creating the Brief → 503, no Ad created', async () => {
    const { api } = setup({ briefFallback: { throws: new LlmUnavailableError('Chiave non configurata.') } })
    const res = await api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'indeed', format: 'text' })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('LLM_UNAVAILABLE')
    expect((await api.get('/api/ads')).body).toHaveLength(3)
  })
})

describe('business rules on LLM output', () => {
  test('street address on social, then a clean retry → Version saved, retry told which field', async () => {
    const { api, fake, seededAd } = setup({ variants: [socialContentWithStreetAddress] })
    const variant = (await seededAd('instagram')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(201)
    expect(fake.calls.generateVariantContent[1]?.previousIssues?.map((i) => i.path)).toEqual(['caption'])
  })

  test('street address on social every time → 502, no Version saved', async () => {
    const { api, seededAd } = setup({ variantFallback: socialContentWithStreetAddress })
    const variant = (await seededAd('instagram')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(502)
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })
})

describe('404 and uniform error shape', () => {
  const cases: Array<[string, string, string, unknown?]> = [
    ['GET', '/api/job-offers/jo_999', 'job offer'],
    ['POST', '/api/job-offers/jo_999/brief', 'job offer (brief)', {}],
    ['POST', '/api/ads', 'job offer (create ad)', { job_offer_id: 'jo_999', channel: 'indeed', format: 'text' }],
    ['GET', '/api/ads/ad_missing', 'ad'],
    ['PATCH', '/api/ads/ad_missing', 'ad (patch)', { status: 'ready' }],
    ['POST', '/api/ads/ad_missing/variants', 'ad (new variant)', { angle: 'carriera' }],
    ['GET', '/api/variants/var_missing/versions', 'variant'],
    ['POST', '/api/variants/var_missing/regenerate', 'variant (regenerate)', {}],
    ['PATCH', '/api/variants/var_missing', 'variant (patch)', { active: false }],
  ]

  for (const [method, path, what, body] of cases) {
    test(`${method} ${path} → 404 (${what})`, async () => {
      const { api } = setup()
      const res =
        method === 'GET'
          ? await api.get(path)
          : method === 'POST'
            ? await api.post(path, body)
            : await api.patch(path, body)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } })
    })
  }
})

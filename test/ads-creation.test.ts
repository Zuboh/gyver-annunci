import { describe, expect, test } from 'bun:test'
import { invalidContent, validVariantContent } from '../src/llm/fake-llm-client'
import { setup } from './helpers'

describe('POST /api/ads', () => {
  test('creates a draft Ad with one Variant per angle, Location defaulted from the Job Offer', async () => {
    const { api } = setup()
    const res = await api.post('/api/ads', {
      job_offer_id: 'jo_001',
      channel: 'whatsapp',
      format: 'image_text',
      angles: ['carriera', 'stipendio'],
    })
    expect(res.status).toBe(201)
    expect(res.body.failedAngles).toEqual([])
    expect(res.body.ad).toMatchObject({ status: 'draft', location: { label: 'Orzinuovi (BS)' } })

    const detail = await api.get(`/api/ads/${res.body.ad.id}`)
    expect(detail.body.variants.map((v: { label: string; angle: string }) => [v.label, v.angle])).toEqual([
      ['A', 'carriera'],
      ['B', 'stipendio'],
    ])
    expect(detail.body.variants[0].currentVersion).toMatchObject({ number: 1, origin: 'llm', model: 'fake-model' })
  })

  test('Channel × Format not allowed → 422 CHANNEL_FORMAT_NOT_ALLOWED, nothing saved', async () => {
    const { api, fake } = setup()
    const res = await api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'indeed', format: 'image' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({
      code: 'CHANNEL_FORMAT_NOT_ALLOWED',
      details: { allowedFormats: ['text'] },
    })
    expect((await api.get('/api/ads')).body).toHaveLength(3)
    expect(fake.calls.generateBrief).toHaveLength(0)
  })

  test('one angle failing → 201, Ad and successful Variants saved, failedAngles has the runId', async () => {
    // Angles generate in parallel: key the fake on the angle, not on call order.
    const { api } = setup({
      variantFallback: (input) => (input.angle === 'stipendio' ? invalidContent : validVariantContent(input)),
    })
    const res = await api.post('/api/ads', {
      job_offer_id: 'jo_001',
      channel: 'indeed',
      format: 'text',
      angles: ['carriera', 'stipendio', 'multinazionale'],
    })
    expect(res.status).toBe(201)
    expect(res.body.failedAngles).toEqual([
      {
        angle: 'stipendio',
        error: { code: 'GENERATION_FAILED', message: expect.any(String), details: { runId: expect.any(String) } },
      },
    ])

    const detail = await api.get(`/api/ads/${res.body.ad.id}`)
    expect(detail.body.variants.map((v: { angle: string }) => v.angle).sort()).toEqual(['carriera', 'multinazionale'])
  })

  test('more than 3 angles → 400 BAD_REQUEST, nothing saved', async () => {
    const { api } = setup()
    const res = await api.post('/api/ads', {
      job_offer_id: 'jo_001',
      channel: 'indeed',
      format: 'text',
      angles: ['carriera', 'stipendio', 'multinazionale', 'trasferte'],
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
    expect((await api.get('/api/ads')).body).toHaveLength(3)
  })
})

describe('Brief reuse and regeneration', () => {
  test('two Ads of the same Job Offer share one Brief (generated once)', async () => {
    const { api, fake } = setup()
    const first = await api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'indeed', format: 'text' })
    const second = await api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'whatsapp', format: 'text' })

    expect(fake.calls.generateBrief).toHaveLength(1)
    const briefIdOf = (body: any) => body.ad.variants[0].currentVersion.briefId
    expect(briefIdOf(second.body)).toBe(briefIdOf(first.body))
  })

  test('POST /api/job-offers/:id/brief regenerates: a new Brief becomes current', async () => {
    const { api, fake } = setup()
    const first = await api.post('/api/job-offers/jo_001/brief')
    const second = await api.post('/api/job-offers/jo_001/brief')
    expect(second.status).toBe(201)
    expect(second.body.id).not.toBe(first.body.id)
    expect(fake.calls.generateBrief).toHaveLength(2)

    const jobOffer = await api.get('/api/job-offers/jo_001')
    expect(jobOffer.body.brief.id).toBe(second.body.id)
  })
})

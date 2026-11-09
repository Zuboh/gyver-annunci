import { describe, expect, test } from 'bun:test'
import { setup } from './helpers'

// Seed: three published Ads of jo_001 (whatsapp, indeed, instagram). Each test adds a draft
// Indeed Ad and a draft WhatsApp Ad so that every filter has something to exclude.
async function withDrafts() {
  const ctx = setup()
  const indeed = await ctx.api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'indeed', format: 'text' })
  const whatsapp = await ctx.api.post('/api/ads', { job_offer_id: 'jo_001', channel: 'whatsapp', format: 'text' })
  return { ...ctx, indeedDraftId: indeed.body.ad.id as string, whatsappDraftId: whatsapp.body.ad.id as string }
}

const ids = (list: Array<{ id: string }>) => list.map((ad) => ad.id).sort()

describe('GET /api/ads filters', () => {
  test('no filter lists every Ad with Channel, Format, Status, Location and active Variant count', async () => {
    const { api } = await withDrafts()
    const res = await api.get('/api/ads')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(5)
    expect(res.body[0]).toMatchObject({
      channelId: expect.any(String),
      format: expect.any(String),
      status: expect.any(String),
      location: { label: expect.any(String) },
      activeVariantCount: 1,
    })
  })

  test('job_offer_id alone', async () => {
    const { api } = await withDrafts()
    expect((await api.get('/api/ads?job_offer_id=jo_001')).body).toHaveLength(5)
    expect((await api.get('/api/ads?job_offer_id=jo_999')).body).toEqual([])
  })

  test('channel alone', async () => {
    const { api, whatsappDraftId } = await withDrafts()
    const res = await api.get('/api/ads?channel=whatsapp')
    expect(res.body).toHaveLength(2)
    expect(res.body.every((ad: { channelId: string }) => ad.channelId === 'whatsapp')).toBe(true)
    expect(ids(res.body)).toContain(whatsappDraftId)
  })

  test('status alone', async () => {
    const { api, indeedDraftId, whatsappDraftId } = await withDrafts()
    expect(ids((await api.get('/api/ads?status=draft')).body)).toEqual([indeedDraftId, whatsappDraftId].sort())
    expect((await api.get('/api/ads?status=published')).body).toHaveLength(3)
  })

  test('job_offer_id + channel + status combined (AND)', async () => {
    const { api, indeedDraftId } = await withDrafts()
    const res = await api.get('/api/ads?job_offer_id=jo_001&channel=indeed&status=draft')
    expect(ids(res.body)).toEqual([indeedDraftId])
  })

  test('a channel filter alone does not imply a status (no injected default)', async () => {
    const { api } = await withDrafts()
    const statuses = (await api.get('/api/ads?channel=indeed')).body.map((ad: { status: string }) => ad.status)
    expect(statuses.sort()).toEqual(['draft', 'published'])
  })

  test('unknown status value → 400 BAD_REQUEST', async () => {
    const { api } = setup()
    const res = await api.get('/api/ads?status=deleted')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })
})

describe('GET /api/job-offers', () => {
  test('lists summaries only, without the internal payload', async () => {
    const { api } = setup()
    const res = await api.get('/api/job-offers')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 'jo_001', title: expect.any(String), companyName: expect.any(String), status: expect.any(String) },
    ])
  })

  test('the detail still carries the payload (internal tool)', async () => {
    const { api } = setup()
    const res = await api.get('/api/job-offers/jo_001')
    expect(res.body.payload.job_offer_id).toBe('jo_001')
  })
})

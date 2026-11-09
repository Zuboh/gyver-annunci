import { describe, expect, test } from 'bun:test'
import { setup } from './helpers'

// jo_001 (src/db/seed-data.ts): ral_min 32000, ral_max 38000.
describe('salary rule on manual Version (PUT /api/variants/:id/content)', () => {
  test('salary outside the Job Offer RAL range → 422 INVALID_CONTENT on the salary field, nothing saved', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]
    const content = { ...variant.currentVersion.content, salary: 'RAL da 45.000 € in base all’esperienza' }

    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('INVALID_CONTENT')
    expect(res.body.error.details.issues).toEqual([{ path: 'salary', message: expect.stringContaining('45.000') }])
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })

  test('salary within the RAL range → 201 with a new manual Version', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]
    const content = { ...variant.currentVersion.content, salary: 'RAL da 32.000 a 38.000 €' }

    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(201)
    expect(res.body.currentVersion).toMatchObject({ number: 2, origin: 'manual', content })
  })
})

describe('only yearly amounts are checked against the RAL', () => {
  test.each([
    ['Stipendio 2.500 € al mese'],
    ['RAL da 32.000 a 38.000 € + premio di 3.000 €'],
    ['RAL da 32.000 a 38.000 €, 1.200 € mensili di indennità'],
  ])('"%s" → 201, no salary issue', async (salary) => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]
    const content = { ...variant.currentVersion.content, salary }
    expect((await api.put(`/api/variants/${variant.id}/content`, { content })).status).toBe(201)
  })

  test('"RAL da 50.000 €" is still flagged', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]
    const content = { ...variant.currentVersion.content, salary: 'RAL da 50.000 €' }
    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues).toEqual([{ path: 'salary', message: expect.stringContaining('50.000') }])
  })
})

describe('GET /api/channels', () => {
  test('returns the 4 channels, each with at least one Format', async () => {
    const { api } = setup()
    const res = await api.get('/api/channels')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(4)
    for (const channel of res.body) {
      expect(Array.isArray(channel.formats)).toBe(true)
      expect(channel.formats.length).toBeGreaterThan(0)
    }
  })
})

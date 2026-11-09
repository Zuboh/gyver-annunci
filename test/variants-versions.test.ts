import { describe, expect, test } from 'bun:test'
import { setup } from './helpers'

describe('manual Version (PUT /api/variants/:id/content)', () => {
  test('valid content → new current Version with origin manual, history intact', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('whatsapp')).variants[0]
    const content = { ...variant.currentVersion.content, title: 'Tecnico Fotovoltaico: cantieri FV in Lombardia' }

    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(201)
    expect(res.body.currentVersion).toMatchObject({ number: 2, origin: 'manual', briefId: null, content })

    const history = await api.get(`/api/variants/${variant.id}/versions`)
    expect(history.body.map((v: { number: number }) => v.number)).toEqual([2, 1])
    expect(history.body[1].content).toEqual(variant.currentVersion.content)
  })

  test('content over the Format constraints → 422 INVALID_CONTENT with per-field issues, nothing saved', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('whatsapp')).variants[0]
    const content = { ...variant.currentVersion.content, title: 'x'.repeat(81) }

    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('INVALID_CONTENT')
    expect(res.body.error.details.issues).toEqual([{ path: 'title', message: expect.stringContaining('80') }])
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })

  test('content of the wrong shape → 422 with the schema path', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]
    const res = await api.put(`/api/variants/${variant.id}/content`, { content: { title: 42 } })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toContain('title')
  })

  test('exact street address on a social Ad → 422 on the field holding it', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('instagram')).variants[0]
    const content = { ...variant.currentVersion.content, caption: 'Vieni a trovarci in Via Artigianato 27, Orzinuovi.' }

    const res = await api.put(`/api/variants/${variant.id}/content`, { content })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toEqual(['caption'])
  })
})

describe('regenerate (POST /api/variants/:id/regenerate)', () => {
  test('appends an llm Version numbered +1 with the same angle', async () => {
    const { api, fake, seededAd } = setup()
    const variant = (await seededAd('indeed')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: variant.id, angle: variant.angle })
    expect(res.body.currentVersion).toMatchObject({ number: 2, origin: 'llm', promptVersion: 'fake@1' })
    expect(fake.calls.generateVariantContent[0]?.angle).toBe(variant.angle)
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(2)
  })
})

describe('new Variant (POST /api/ads/:id/variants)', () => {
  test('adds Variant B with the given angle', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const res = await api.post(`/api/ads/${ad.id}/variants`, { angle: 'stipendio' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ label: 'B', angle: 'stipendio', active: true, currentVersion: { number: 1 } })
  })
})

describe('discard Variant (PATCH /api/variants/:id)', () => {
  test('inactive Variant is not counted as active but stays in detail and history', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const added = await api.post(`/api/ads/${ad.id}/variants`, { angle: 'stipendio' })

    const res = await api.patch(`/api/variants/${added.body.id}`, { active: false })
    expect(res.status).toBe(200)
    expect(res.body.active).toBe(false)

    const listed = (await api.get('/api/ads?channel=indeed')).body[0]
    expect(listed.activeVariantCount).toBe(1)
    const detail = await api.get(`/api/ads/${ad.id}`)
    expect(detail.body.variants.map((v: { label: string; active: boolean }) => [v.label, v.active])).toEqual([
      ['A', true],
      ['B', false],
    ])
    expect((await api.get(`/api/variants/${added.body.id}/versions`)).body).toHaveLength(1)
  })
})

describe('PATCH /api/ads/:id', () => {
  test('changes Status and Location, persisted', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const location = { label: 'Brescia e provincia', municipality: 'Brescia', provinceCode: 'BS' }

    const res = await api.patch(`/api/ads/${ad.id}`, { status: 'archived', location })
    expect(res.status).toBe(200)

    const detail = await api.get(`/api/ads/${ad.id}`)
    expect(detail.body.status).toBe('archived')
    expect(detail.body.location).toEqual({
      label: 'Brescia e provincia',
      municipality: 'Brescia',
      province: null,
      provinceCode: 'BS',
      region: null,
      country: 'IT',
    })
  })

  test('Status only keeps the Location', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('whatsapp')
    await api.patch(`/api/ads/${ad.id}`, { status: 'paused' })
    const detail = await api.get(`/api/ads/${ad.id}`)
    expect(detail.body).toMatchObject({ status: 'paused', location: ad.location })
  })

  test('empty body → 400 and nothing changes', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const res = await api.patch(`/api/ads/${ad.id}`, {})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
    expect((await api.get(`/api/ads/${ad.id}`)).body.status).toBe('published')
  })
})

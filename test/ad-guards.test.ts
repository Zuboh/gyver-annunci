import { describe, expect, test } from 'bun:test'
import { setup } from './helpers'

describe('archived Ad is frozen (422 AD_ARCHIVED)', () => {
  test('regenerate, new Variant, manual Version and discard are refused; no LLM call, nothing saved', async () => {
    const { api, fake, seededAd } = setup()
    const ad = await seededAd('indeed')
    const variant = ad.variants[0]
    expect((await api.patch(`/api/ads/${ad.id}`, { status: 'archived' })).status).toBe(200)

    const attempts = [
      await api.post(`/api/variants/${variant.id}/regenerate`),
      await api.post(`/api/ads/${ad.id}/variants`, { angle: 'stipendio' }),
      await api.put(`/api/variants/${variant.id}/content`, { content: variant.currentVersion.content }),
      await api.patch(`/api/variants/${variant.id}`, { active: false }),
    ]
    for (const res of attempts) {
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('AD_ARCHIVED')
    }
    expect(fake.calls.generateVariantContent).toHaveLength(0)
    const detail = (await api.get(`/api/ads/${ad.id}`)).body
    expect(detail.variants).toHaveLength(1)
    expect(detail.variants[0]).toMatchObject({ active: true, currentVersion: { number: 1 } })
  })

  test('the Status itself can still change: un-archiving makes the Ad editable again', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    await api.patch(`/api/ads/${ad.id}`, { status: 'archived' })

    expect((await api.patch(`/api/ads/${ad.id}`, { status: 'draft' })).status).toBe(200)
    expect((await api.post(`/api/variants/${ad.variants[0].id}/regenerate`)).status).toBe(201)
  })
})

describe('ready / published need an active Variant (422 AD_HAS_NO_ACTIVE_VARIANT)', () => {
  test('no active Variant → ready and published refused, other Statuses allowed', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('whatsapp')
    await api.patch(`/api/variants/${ad.variants[0].id}`, { active: false })

    for (const status of ['ready', 'published']) {
      const res = await api.patch(`/api/ads/${ad.id}`, { status })
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('AD_HAS_NO_ACTIVE_VARIANT')
    }
    expect((await api.get(`/api/ads/${ad.id}`)).body.status).toBe(ad.status)
    expect((await api.patch(`/api/ads/${ad.id}`, { status: 'paused' })).status).toBe(200)
  })

  test('with an active Variant → ready allowed', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('whatsapp')
    expect((await api.patch(`/api/ads/${ad.id}`, { status: 'ready' })).status).toBe(200)
  })
})

describe('restoring a Variant keeps active angles distinct', () => {
  test('restore when another active Variant has the same angle → 400, Variant stays discarded', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const original = ad.variants[0]
    await api.patch(`/api/variants/${original.id}`, { active: false })
    const replacement = await api.post(`/api/ads/${ad.id}/variants`, { angle: ` ${original.angle.toUpperCase()} ` })
    expect(replacement.status).toBe(201)

    const res = await api.patch(`/api/variants/${original.id}`, { active: true })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'BAD_REQUEST', details: { angle: original.angle } })
    const detail = (await api.get(`/api/ads/${ad.id}`)).body
    expect(detail.variants.map((v: { active: boolean }) => v.active)).toEqual([false, true])
  })

  test('restoring with a free angle (or re-activating an active one) → 200', async () => {
    const { api, seededAd } = setup()
    const ad = await seededAd('indeed')
    const variant = ad.variants[0]
    expect((await api.patch(`/api/variants/${variant.id}`, { active: true })).status).toBe(200)
    await api.patch(`/api/variants/${variant.id}`, { active: false })
    expect((await api.patch(`/api/variants/${variant.id}`, { active: true })).body.active).toBe(true)
  })
})

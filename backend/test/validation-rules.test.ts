import { describe, expect, test } from 'bun:test'
import type { GenerateVariantContentInput } from '../src/llm/llm-client'
import { validVariantContent } from '../src/llm/fake-llm-client'
import { setup } from './helpers'

// jo_001 (backend/src/db/seed-data.ts): RAL 32.000–38.000 €; "Indennità di 60 € lordi a notte per le
// trasferte multi-giorno"; daily trips have no allowance.

type Content = Record<string, any>
/** Fake step: the valid fixture for the channel with `patch` applied. */
const patched = (patch: (content: Content) => Content) => (input: GenerateVariantContentInput) =>
  patch(validVariantContent(input) as Content)

describe('allowance keeps its condition (LLM output)', () => {
  test('"Indennità di 60 € per le trasferte" → retry told the field, clean retry saved', async () => {
    const { api, fake, seededAd } = setup({
      variants: [
        patched((c) => ({ ...c, badges: [...c.badges, 'Indennità di 60 € per le trasferte'] })),
      ],
    })
    const variant = (await seededAd('whatsapp')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(201)
    const [, retry] = fake.calls.generateVariantContent
    expect(retry?.previousIssues).toEqual([{ path: 'badges.3', message: expect.stringContaining('a notte') }])
  })

  test('allowance with its condition passes on the first attempt', async () => {
    const { api, fake, seededAd } = setup({
      variants: [
        patched((c) => ({
          ...c,
          badges: [...c.badges, 'Indennità di 60 € a notte (più giorni)'],
        })),
      ],
    })
    const variant = (await seededAd('whatsapp')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    expect(fake.calls.generateVariantContent).toHaveLength(1)
  })

  test('manual Version is not subject to the rule (PDF example "+ indennità") → 201', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('whatsapp')).variants[0]
    const content = { ...variant.currentVersion.content, title: 'Tecnico Fotovoltaico: RAL + indennità' }
    expect((await api.put(`/api/variants/${variant.id}/content`, { content })).status).toBe(201)
  })
})

describe('salary wording (LLM output)', () => {
  test.each([
    ['RAL da 38.000 €'],
    ['RAL 38.000 €'],
  ])('"%s" → retry with an issue on salary', async (salary) => {
    const { api, fake, seededAd } = setup({ variants: [patched((c) => ({ ...c, salary }))] })
    const variant = (await seededAd('indeed')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    const [, retry] = fake.calls.generateVariantContent
    expect(retry?.previousIssues).toEqual([{ path: 'salary', message: expect.stringContaining('fuorviante') }])
  })

  test.each([
    ['RAL da 32.000 a 38.000 €'],
    ['RAL fino a 38.000 €'],
    ['RAL da 32.000 €'],
  ])('"%s" passes on the first attempt', async (salary) => {
    const { api, fake, seededAd } = setup({ variants: [patched((c) => ({ ...c, salary }))] })
    const variant = (await seededAd('indeed')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    expect(fake.calls.generateVariantContent).toHaveLength(1)
  })
})

describe('highlightWord is one whole word of the overlay (every Version)', () => {
  const withHighlight = (variant: any, highlightWord: string) => ({
    ...variant.currentVersion.content,
    creative: { ...variant.currentVersion.content.creative, highlightWord },
  })

  test('a phrase → 422 on creative.highlightWord', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('instagram')).variants[0]
    const res = await api.put(`/api/variants/${variant.id}/content`, {
      content: withHighlight(variant, 'Impianti FV'),
    })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues).toEqual([
      { path: 'creative.highlightWord', message: expect.stringContaining('una sola parola') },
    ])
  })

  test('part of a word → 422 on creative.highlightWord', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('instagram')).variants[0]
    const res = await api.put(`/api/variants/${variant.id}/content`, { content: withHighlight(variant, 'Fotov') })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues).toEqual([
      { path: 'creative.highlightWord', message: expect.stringContaining('parola intera') },
    ])
  })

  test('a whole word, any case → 201', async () => {
    const { api, seededAd } = setup()
    const variant = (await seededAd('instagram')).variants[0]
    const res = await api.put(`/api/variants/${variant.id}/content`, { content: withHighlight(variant, 'multinazionale') })
    expect(res.status).toBe(201)
  })

  test('LLM output with a phrase → retried', async () => {
    const { api, fake, seededAd } = setup({
      variants: [patched((c) => ({ ...c, creative: { ...c.creative, highlightWord: 'Tecnico Fotovoltaico' } }))],
    })
    const variant = (await seededAd('instagram')).variants[0]
    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    expect(fake.calls.generateVariantContent[1]?.previousIssues?.map((i) => i.path)).toEqual(['creative.highlightWord'])
  })
})

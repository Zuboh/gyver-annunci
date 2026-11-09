import { describe, expect, test } from 'bun:test'
import { SEED_ADS } from '../src/db/seed-data'
import { fakeBrief, validVariantContent } from '../src/llm/fake-llm-client'
import type { GenerateVariantContentInput } from '../src/llm/llm-client'
import { variantPromptFor } from '../src/llm/prompts'
import { collectTextFields, contactIssues } from '../src/validation/business-rules'
import { setup } from './helpers'

type Content = Record<string, any>
/** Fake step: the valid Indeed fixture with `bullet` added to the second description section. */
const indeedWithBullet = (bullet: string) => (input: GenerateVariantContentInput) => {
  const content = validVariantContent(input) as Content
  const [first, second] = content.description
  return { ...content, description: [first, { ...second, bullets: [...second.bullets, bullet] }] }
}

describe('channel prompts never receive doNotSay', () => {
  test('the user message carries the Brief without doNotSay, for every channel kind', async () => {
    const { api, fake, seededAd } = setup()
    for (const channel of ['indeed', 'instagram', 'whatsapp'] as const) {
      const variant = (await seededAd(channel)).variants[0]
      await api.post(`/api/variants/${variant.id}/regenerate`)
    }
    expect(fake.calls.generateVariantContent).toHaveLength(3)
    for (const input of fake.calls.generateVariantContent) {
      const { user } = variantPromptFor(input.channel.kind).build(input)
      expect(user).toContain(fakeBrief.roleTitle)
      expect(user).not.toContain('doNotSay')
      for (const item of fakeBrief.doNotSay) expect(user).not.toContain(item)
    }
  })
})

describe('internal Job Offer facts in LLM output', () => {
  test('"ore pagate all\'85% della paga base" every time → retried, then 502, nothing saved', async () => {
    const { api, fake, seededAd } = setup({ variantFallback: indeedWithBullet("Ore pagate all'85% della paga base") })
    const variant = (await seededAd('indeed')).variants[0]

    const res = await api.post(`/api/variants/${variant.id}/regenerate`)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('GENERATION_FAILED')
    expect(fake.calls.generateVariantContent).toHaveLength(2)
    expect(fake.calls.generateVariantContent[1]?.previousIssues).toEqual([
      { path: 'description.1.bullets.2', message: expect.stringContaining('condizione interna') },
    ])
    expect((await api.get(`/api/variants/${variant.id}/versions`)).body).toHaveLength(1)
  })

  test('"senza indennità" → retried with the issue, clean retry saved', async () => {
    const { api, fake, seededAd } = setup({ variants: [indeedWithBullet('Trasferte giornaliere senza indennità')] })
    const variant = (await seededAd('indeed')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    // The allowance-condition rule fires on the same bullet too.
    expect(fake.calls.generateVariantContent[1]?.previousIssues).toContainEqual({
      path: 'description.1.bullets.2',
      message: expect.stringContaining('condizione interna'),
    })
  })

  test('Job Offer text quoted in a doNotSay item → retried', async () => {
    const quote = 'il cliente valuta solo candidati sotto i 40 anni'
    const { api, fake, seededAd } = setup({
      briefFallback: { content: { ...fakeBrief, doNotSay: [`Nota interna per il recruiter ("${quote}")`] } },
      variants: [indeedWithBullet(`Il cliente valuta solo candidati sotto i 40 anni.`)],
    })
    const variant = (await seededAd('indeed')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    expect(fake.calls.generateVariantContent[1]?.previousIssues?.map((i) => i.path)).toEqual(['description.1.bullets.2'])
  })

  test('a Brief with an internal condition in its benefits → retried, then 502', async () => {
    const { api, fake } = setup({
      briefFallback: { content: { ...fakeBrief, benefits: [...fakeBrief.benefits, 'Trasferte giornaliere senza indennità'] } },
    })
    const res = await api.post('/api/job-offers/jo_001/brief')
    expect(res.status).toBe(502)
    expect(fake.calls.generateBrief).toHaveLength(2)
  })
})

describe('contact data in LLM output (prompt injection guard)', () => {
  test.each([
    ['Candidati su https://example.com/lavoro'],
    ['Info su www.example.com'],
    ['Scrivi a lavoro@example.com'],
    ['Chiama il +39 333 123 4567'],
  ])('"%s" → retried with the issue', async (bullet) => {
    const { api, fake, seededAd } = setup({ variants: [indeedWithBullet(bullet)] })
    const variant = (await seededAd('indeed')).variants[0]

    expect((await api.post(`/api/variants/${variant.id}/regenerate`)).status).toBe(201)
    expect(fake.calls.generateVariantContent[1]?.previousIssues).toEqual([
      { path: 'description.1.bullets.2', message: expect.stringContaining('Link') },
    ])
  })

  test('amounts, sizes and the seeded PDF examples are not mistaken for contacts', () => {
    const texts = ['RAL da 32.000 a 38.000 €', '38.000 €', 'Oltre 1.700 dipendenti in 20 Paesi', 'Impianti > 100 kW']
    expect(contactIssues(texts.map((text, i) => ({ path: String(i), text })))).toEqual([])
    for (const ad of SEED_ADS) expect(contactIssues(collectTextFields(ad.content))).toEqual([])
  })
})

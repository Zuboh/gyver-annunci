// Programmable LlmClient for tests: no network, no key. Each call consumes the next scripted
// step of its queue; when the queue is empty the fallback step runs (default: a valid
// Italian fixture for the channel kind and format). Every call is recorded in `calls`.
import type {
  BriefContent,
  Creative,
  JobBoardContent,
  MessagingContent,
  SocialAdContent,
} from '../domain/types'
import type {
  GenerateBriefInput,
  GenerateVariantContentInput,
  LlmClient,
  LlmResult,
} from './llm-client'

/** Return this content | throw this error | compute the content from the call input. */
export type FakeStep<I, T> = { content: T } | { throws: Error } | ((input: I) => T)

export type FakeBriefStep = FakeStep<GenerateBriefInput, BriefContent>
export type FakeVariantStep = FakeStep<GenerateVariantContentInput, unknown>

export interface FakeLlmScript {
  /** Consumed in order, one per generateBrief call. */
  briefs?: FakeBriefStep[]
  /** Consumed in order, one per generateVariantContent call. */
  variants?: FakeVariantStep[]
  /** Used once `briefs` is empty. Default: `{ content: fakeBrief }`. */
  briefFallback?: FakeBriefStep
  /** Used once `variants` is empty. Default: `validVariantContent`. */
  variantFallback?: FakeVariantStep
}

export const FAKE_MODEL = 'fake-model'
export const FAKE_PROMPT_VERSION = 'fake@1'

export class FakeLlmClient implements LlmClient {
  readonly calls: {
    generateBrief: GenerateBriefInput[]
    generateVariantContent: GenerateVariantContentInput[]
  } = { generateBrief: [], generateVariantContent: [] }

  private readonly briefs: FakeBriefStep[]
  private readonly variants: FakeVariantStep[]
  private readonly briefFallback: FakeBriefStep
  private readonly variantFallback: FakeVariantStep

  constructor(script: FakeLlmScript = {}) {
    this.briefs = [...(script.briefs ?? [])]
    this.variants = [...(script.variants ?? [])]
    this.briefFallback = script.briefFallback ?? { content: fakeBrief }
    this.variantFallback = script.variantFallback ?? validVariantContent
  }

  async generateBrief(input: GenerateBriefInput): Promise<LlmResult<BriefContent>> {
    this.calls.generateBrief.push(input)
    return result(runStep(this.briefs.shift() ?? this.briefFallback, input))
  }

  async generateVariantContent(input: GenerateVariantContentInput): Promise<LlmResult<unknown>> {
    this.calls.generateVariantContent.push(input)
    return result(runStep(this.variants.shift() ?? this.variantFallback, input))
  }
}

function runStep<I, T>(step: FakeStep<I, T>, input: I): T {
  if (typeof step === 'function') return step(input)
  if ('throws' in step) throw step.throws
  return step.content
}

function result<T>(content: T): LlmResult<T> {
  return { content, raw: JSON.stringify(content), model: FAKE_MODEL, promptVersion: FAKE_PROMPT_VERSION }
}

// ---------------------------------------------------------------------------
// Fixtures (Italian, based on jo_001 of the assignment: RAL 32.000–38.000 €, Orzinuovi BS)
// ---------------------------------------------------------------------------

export const fakeBrief: BriefContent = {
  roleTitle: 'Tecnico Fotovoltaico',
  companyName: 'AB Group SpA',
  companyPitch:
    'AB Group è una multinazionale con oltre 1.700 dipendenti e più di 40 anni di storia in impianti industriali, cogenerazione e fotovoltaico.',
  contractType: 'Tempo indeterminato',
  salary: { min: 32000, max: 38000, currency: 'EUR' },
  experience: { minYears: 3, maxYears: 5 },
  skills: ['Fotovoltaico industriale', 'Cabine secondarie MT/BT'],
  responsibilities: [
    'Coordini il montaggio degli impianti fotovoltaici insieme al PM',
    'Esegui collaudi e test funzionali su impianti di grandi dimensioni',
    'Esegui manutenzioni sul campo in caso di guasti',
  ],
  requirements: [
    'Diploma tecnico in elettrotecnica',
    '3-5 anni di esperienza su impianti fotovoltaici industriali (> 100 kW)',
    'Esperienza in media tensione',
    'Disponibilità a trasferte',
  ],
  benefits: ['Ticket da 13 € al giorno', 'Indennità per le trasferte di più giorni'],
  sellingPoints: [
    'Entri in una multinazionale',
    'Crescita verso ruoli gestionali',
    'Impianti FV sopra i 100 kW',
  ],
  workArea: 'Orzinuovi (BS)',
  siteAddress: 'Via Artigianato, 27, 25034 Orzinuovi BS',
  travel: 'Trasferte giornaliere frequenti e sporadiche trasferte di 2-3 giorni',
  doNotSay: ['Trasferte giornaliere senza indennità', 'Straordinari di viaggio pagati all\'85%'],
  suggestedAngles: ['carriera', 'stipendio', 'multinazionale'],
}

/** Creative sized from the ChannelFormat, or null for text-only formats. */
export function creativeFor(input: GenerateVariantContentInput): Creative | null {
  const image = input.channelFormat.constraints.image
  if (input.channelFormat.format === 'text' || image === null) return null
  return {
    overlayTexts: ['Tecnico Fotovoltaico', 'Entra in una multinazionale', 'Impianti FV >100 kW'],
    highlightWord: 'Fotovoltaico',
    photoSubject: 'Tecnico con casco bianco e giacca alta visibilità davanti a pannelli fotovoltaici',
    width: image.width,
    height: image.height,
  }
}

/** Valid content for the input's channel kind and format (salary coherent, no street address on social/messaging). */
export function validVariantContent(input: GenerateVariantContentInput): unknown {
  const creative = creativeFor(input)
  switch (input.channel.kind) {
    case 'job_board':
      return {
        title: 'Tecnico Fotovoltaico - coordinamento cantieri e manutenzione',
        companyName: 'AB Group SpA',
        address: 'Via Artigianato, 27, 25034 Orzinuovi BS',
        skills: ['Fotovoltaico industriale', 'Cabine secondarie MT/BT'],
        experience: '3-5 anni',
        contractType: 'Tempo indeterminato',
        salary: 'RAL da 32.000 a 38.000 €',
        description: [
          {
            heading: 'Assunzione diretta a tempo indeterminato in AB Group SpA',
            bullets: ['Multinazionale con oltre 1.700 dipendenti e 40 anni di storia'],
          },
          {
            heading: 'Il tuo profilo',
            bullets: ['3-5 anni di esperienza su impianti FV industriali', 'Disponibilità a trasferte'],
          },
        ],
        creative,
      } satisfies JobBoardContent
    case 'social_ad':
      return {
        caption: `Cerchiamo un Tecnico Fotovoltaico a ${input.location.label}. Entra in una multinazionale e cresci con noi.`,
        hashtags: ['#fotovoltaico', '#lavoro', '#tecnici'],
        callToAction: 'Candidati ora',
        creative,
      } satisfies SocialAdContent
    case 'messaging':
      return {
        title: 'Tecnico Fotovoltaico: coordinamento cantieri e manutenzione',
        companyName: 'AB Group SpA',
        badges: ['RAL da €32.000 a €38.000', 'Tempo indeterminato', input.location.label],
        sections: [
          {
            heading: 'Quello che ti offre l\'azienda',
            bullets: ['Contratto a tempo indeterminato', 'Crescita a ruoli gestionali'],
          },
          {
            heading: 'Il tuo profilo',
            bullets: ['3-5 anni di esperienza su impianti FV', 'Esperienza in MT'],
          },
        ],
        creative,
      } satisfies MessagingContent
  }
}

/** Social content that is schema-valid but shows the exact street address (business rule violation). */
export function socialContentWithStreetAddress(input: GenerateVariantContentInput): SocialAdContent {
  return {
    caption: 'Tecnico Fotovoltaico: ti aspettiamo in Via Artigianato 27, 25034 Orzinuovi (BS).',
    hashtags: ['#fotovoltaico'],
    callToAction: 'Candidati ora',
    creative: creativeFor(input),
  }
}

/** Content that fails every channel schema (use as `{ content: invalidContent }`). */
export const invalidContent: unknown = { title: 42 }

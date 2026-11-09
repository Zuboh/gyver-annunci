// Single validation entry point for Variant content, used for both LLM output and manual
// Versions (SPEC "Validazione contenuto"). Pure: no DB, no LLM. Issue messages are Italian.
// Order: channel-kind schema (shape) → ChannelFormat constraints (data) → business rules.
import { z } from 'zod'
import { contentSchemaFor } from '../domain/content-schemas'
import type {
  Channel,
  ChannelContent,
  ChannelFormat,
  ContentIssue,
  Creative,
  Format,
  JobOffer,
} from '../domain/types'
import { collectTextFields, salaryIssues, streetAddressIssues } from './business-rules'

export interface ValidationContext {
  channel: Channel
  channelFormat: ChannelFormat
  /** Source of truth for business rules (salary coherence, street address to forbid). */
  jobOffer: JobOffer
}

export type ValidationResult =
  | { ok: true; content: ChannelContent }
  | { ok: false; issues: ContentIssue[] }

const italianErrors = z.locales.it().localeError

const FORMAT_LABELS: Record<Format, string> = {
  text: 'solo testo',
  image: 'solo immagine',
  image_text: 'immagine più testo',
}

export function validateContent(content: unknown, ctx: ValidationContext): ValidationResult {
  const parsed = contentSchemaFor(ctx.channel.kind).safeParse(content, { error: italianErrors })
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    }
  }

  const fields = collectTextFields(parsed.data)
  const issues = [
    ...constraintIssues(parsed.data, ctx.channelFormat),
    ...creativeIssues(parsed.data.creative, ctx.channelFormat),
    ...streetAddressIssues(fields, ctx.channel, ctx.jobOffer.payload.location),
    ...salaryIssues(fields, ctx.jobOffer.payload),
  ]
  return issues.length > 0 ? { ok: false, issues } : { ok: true, content: parsed.data }
}

// ---------------------------------------------------------------------------
// ChannelFormat constraints: field paths use `*` for "every array element".
// ---------------------------------------------------------------------------

interface Located {
  path: string
  value: unknown
}

/** Values matching a constraint path, e.g. "sections.*.bullets" → one entry per section. */
function valuesAt(root: unknown, pattern: string): Located[] {
  const join = (path: string, key: string) => (path === '' ? key : `${path}.${key}`)
  let current: Located[] = [{ path: '', value: root }]
  for (const segment of pattern.split('.')) {
    current = current.flatMap(({ path, value }) => {
      if (segment === '*') {
        return Array.isArray(value) ? value.map((item, i) => ({ path: join(path, String(i)), value: item })) : []
      }
      const child = value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
      return [{ path: join(path, segment), value: child }]
    })
  }
  return current
}

const isBlank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

function constraintIssues(content: ChannelContent, channelFormat: ChannelFormat): ContentIssue[] {
  const { maxLength, maxItems, requiredFields } = channelFormat.constraints
  const issues: ContentIssue[] = []
  for (const pattern of requiredFields) {
    for (const { path, value } of valuesAt(content, pattern)) {
      if (isBlank(value)) issues.push({ path, message: 'Campo obbligatorio per questo formato.' })
    }
  }
  for (const [pattern, max] of Object.entries(maxLength)) {
    for (const { path, value } of valuesAt(content, pattern)) {
      const length = typeof value === 'string' ? [...value].length : 0
      if (length > max) issues.push({ path, message: `Massimo ${max} caratteri (attuali ${length}).` })
    }
  }
  for (const [pattern, max] of Object.entries(maxItems)) {
    for (const { path, value } of valuesAt(content, pattern)) {
      if (Array.isArray(value) && value.length > max) {
        issues.push({ path, message: `Massimo ${max} elementi (attuali ${value.length}).` })
      }
    }
  }
  return issues
}

/** A Creative exists iff the Format has an image, sized as the ChannelFormat requires. */
function creativeIssues(creative: Creative | null, channelFormat: ChannelFormat): ContentIssue[] {
  const { format, constraints } = channelFormat
  const label = FORMAT_LABELS[format]
  if (format === 'text') {
    return creative === null
      ? []
      : [{ path: 'creative', message: `Il formato ${label} non prevede una Creative: imposta null.` }]
  }
  if (creative === null) {
    return [{ path: 'creative', message: `La Creative è obbligatoria per il formato ${label}.` }]
  }

  const issues: ContentIssue[] = []
  const image = constraints.image
  if (image !== null) {
    if (creative.width !== image.width) {
      issues.push({
        path: 'creative.width',
        message: `Larghezza attesa ${image.width}px (${image.aspectRatio}), ricevuta ${creative.width}px.`,
      })
    }
    if (creative.height !== image.height) {
      issues.push({
        path: 'creative.height',
        message: `Altezza attesa ${image.height}px (${image.aspectRatio}), ricevuta ${creative.height}px.`,
      })
    }
  }
  const highlight = creative.highlightWord?.trim().toLowerCase()
  if (highlight && !creative.overlayTexts.some((text) => text.toLowerCase().includes(highlight))) {
    issues.push({
      path: 'creative.highlightWord',
      message: 'La parola evidenziata deve comparire in uno dei testi in sovrimpressione.',
    })
  }
  return issues
}

// Business rules on Variant content that a JSON schema cannot express (SPEC "Validazione
// contenuto"): no exact street address outside job boards, salary coherent with the Job Offer.
// Both scan every string of the content, so they hold whatever field the text ends up in.
import type { Channel, ContentIssue, JobOfferPayload } from '../domain/types'

export interface TextField {
  /** ContentIssue path of the string, e.g. "sections.1.bullets.0". */
  path: string
  text: string
}

/** Every string in `value`, with its dot path (array indexes as numbers). */
export function collectTextFields(value: unknown, path = ''): TextField[] {
  if (typeof value === 'string') return [{ path, text: value }]
  const join = (key: string | number) => (path === '' ? String(key) : `${path}.${key}`)
  if (Array.isArray(value)) return value.flatMap((item, i) => collectTextFields(item, join(i)))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => collectTextFields(item, join(key)))
  }
  return []
}

// "Via Artigianato, 27", "viale Monza 12", "Piazza San Marco 1": street keyword, 1–4
// capitalised words, civic number. Lowercase words after the keyword ("via email") don't match.
const STREET_ADDRESS =
  /\b(?:[Vv]ia|[Vv]iale|[Pp]iazza|[Pp]iazzale|[Cc]orso|[Ll]argo|[Vv]icolo|[Ss]trada)\s+(?:[A-ZÀ-Ý][\p{L}'’.]*[\s,]+){1,4}\d{1,4}\b/u

/** Job boards publish the site address in a dedicated field; social ads and messaging must not. */
export function streetAddressIssues(
  fields: TextField[],
  channel: Channel,
  site: JobOfferPayload['location'],
): ContentIssue[] {
  if (channel.kind === 'job_board') return []
  const streetName = site.street_name.trim().toLowerCase()
  const postalCode = new RegExp(`\\b${site.postal_code}\\b`)
  return fields
    .filter(
      ({ text }) =>
        STREET_ADDRESS.test(text) ||
        (streetName !== '' && text.toLowerCase().includes(streetName)) ||
        (site.postal_code !== '' && postalCode.test(text)),
    )
    .map(({ path }) => ({
      path,
      message: `Indirizzo esatto non ammesso su ${channel.name}: indica solo l'area geografica (es. comune e provincia).`,
    }))
}

// Amounts as written in Italian copy: "38.000", "38'000", "38000", "38k".
const AMOUNT = /(\d{1,3}(?:[.'’]\d{3})+|\d+)(?:,\d+)?(\s?k(?![a-z]))?/gi
const CURRENCY_BEFORE = /(?:€|\beur|\beuro)\s*$/i
const CURRENCY_AFTER = /^\s*(?:€|eur\b|euro\b)/i
const SALARY_WORD_BEFORE = /\b(?:ral|retribuzione|stipendio|salario)\b\D{0,20}$/i
/** Below this an amount is a daily/benefit figure (ticket, indennità), not a yearly salary. */
const MIN_YEARLY_AMOUNT = 1000

/** Yearly-salary-sized money amounts in `text` (with € / EUR / RAL next to the number). */
export function salaryAmounts(text: string): number[] {
  const amounts: number[] = []
  for (const match of text.matchAll(AMOUNT)) {
    const start = match.index
    const end = start + match[0].length
    const before = text.slice(Math.max(0, start - 25), start)
    const after = text.slice(end, end + 6)
    const isMoney =
      CURRENCY_BEFORE.test(before) || CURRENCY_AFTER.test(after) || SALARY_WORD_BEFORE.test(before)
    const digits = match[1] ?? ''
    const value = Number(digits.replace(/[.'’]/g, '')) * (match[2] ? 1000 : 1)
    if (isMoney && value >= MIN_YEARLY_AMOUNT) amounts.push(value)
  }
  return amounts
}

const euro = (n: number) => `${n.toLocaleString('it-IT')} €`

/** Every salary figure shown must fall inside the Job Offer's RAL range. */
export function salaryIssues(fields: TextField[], offer: JobOfferPayload): ContentIssue[] {
  const { ral_min: min, ral_max: max } = offer
  const range =
    min !== null && max !== null
      ? `RAL da ${euro(min)} a ${euro(max)}`
      : min !== null
        ? `RAL da ${euro(min)}`
        : max !== null
          ? `RAL fino a ${euro(max)}`
          : null
  const issues: ContentIssue[] = []
  for (const { path, text } of fields) {
    for (const amount of salaryAmounts(text)) {
      if (range === null) {
        issues.push({ path, message: `La Job Offer non indica una retribuzione: rimuovi la cifra ${euro(amount)}.` })
      } else if ((min !== null && amount < min) || (max !== null && amount > max)) {
        issues.push({
          path,
          message: `La retribuzione ${euro(amount)} non è coerente con la Job Offer (${range}).`,
        })
      }
    }
  }
  return issues
}

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
/** Amounts per month, night or day ("2.500 € al mese", "60 € a notte"): not a yearly RAL. */
const NON_YEARLY_AFTER = /^\D{0,20}?(?:al mese|mensil|\/\s?mese|a notte|al giorno|giornalier)/i
/** Amounts of a bonus or benefit ("premio di 1.500 €", "indennità di 1.200 €"): not the RAL. */
const BENEFIT_BEFORE = /(?:bonus|premio|ticket|indennit)\D{0,20}$/i

interface SalaryMatch {
  value: number
  start: number
  end: number
}

/** Yearly-salary-sized money amounts in `text` (with € / EUR / RAL next to the number), skipping monthly, daily and benefit figures. */
export function salaryAmounts(text: string): number[] {
  return salaryMatches(text).map((m) => m.value)
}

/** Like salaryAmounts, with the position of each amount in `text`. */
function salaryMatches(text: string): SalaryMatch[] {
  const amounts: SalaryMatch[] = []
  for (const match of text.matchAll(AMOUNT)) {
    const start = match.index
    const end = start + match[0].length
    const before = text.slice(Math.max(0, start - 25), start)
    const after = text.slice(end, end + 6)
    const isMoney =
      CURRENCY_BEFORE.test(before) || CURRENCY_AFTER.test(after) || SALARY_WORD_BEFORE.test(before)
    const notYearly = NON_YEARLY_AFTER.test(text.slice(end, end + 30)) || BENEFIT_BEFORE.test(before)
    const digits = match[1] ?? ''
    const value = Number(digits.replace(/[.'’]/g, '')) * (match[2] ? 1000 : 1)
    if (isMoney && !notYearly && value >= MIN_YEARLY_AMOUNT) amounts.push({ value, start, end })
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

// ---------------------------------------------------------------------------
// Stricter rules for LLM output only (validateContent with origin "llm"). Manual Versions,
// like the PDF examples in the seed ("RAL iniziale da €38'000 + indennità"), are an editorial
// choice of the Team Delivery and are not checked by these two rules.
// ---------------------------------------------------------------------------

const FROM_BEFORE = /\b(?:da|tra)\s*(?:€|eur|euro)?\s*$/i
const UP_TO_BEFORE = /\bfino\s+a\s*(?:€|eur|euro)?\s*$/i
const RANGE_JOIN = /^\s*(?:€|eur|euro)?\s*(?:a|e|-|–|—)\s*(?:€|eur|euro)?\s*$/i

/**
 * Salary shown only as "da <min> a <max>" (or "<min> - <max>", "tra <min> e <max>"),
 * "fino a <max>" or "da <min>". Rejects e.g. "RAL da 38.000 €" (suggests 38.000 as the
 * minimum) and a bare "RAL 38.000 €". Amounts outside the range are left to salaryIssues.
 */
export function salaryWordingIssues(fields: TextField[], offer: JobOfferPayload): ContentIssue[] {
  const { ral_min: min, ral_max: max } = offer
  if (min === null || max === null) return []
  const allowed = `usa "RAL da ${euro(min)} a ${euro(max)}", "RAL fino a ${euro(max)}" o "RAL da ${euro(min)}"`
  const issues: ContentIssue[] = []
  for (const { path, text } of fields) {
    const matches = salaryMatches(text)
    matches.forEach((m, i) => {
      if (m.value < min || m.value > max) return
      const before = text.slice(Math.max(0, m.start - 20), m.start)
      const prev = matches[i - 1]
      const next = matches[i + 1]
      const startsRange = next !== undefined && next.value === max && RANGE_JOIN.test(text.slice(m.end, next.start))
      const endsRange = prev !== undefined && prev.value === min && RANGE_JOIN.test(text.slice(prev.end, m.start))
      const ok =
        (m.value === min && (FROM_BEFORE.test(before) || startsRange)) ||
        (m.value === max && (UP_TO_BEFORE.test(before) || endsRange))
      if (!ok) {
        issues.push({ path, message: `Retribuzione ${euro(m.value)} scritta in modo fuorviante: ${allowed}.` })
      }
    })
  }
  return issues
}

const ALLOWANCE = /indennit[àa]/i
/** Conditions an allowance can be tied to in a Job Offer, and how copy may express them. */
const ALLOWANCE_CONDITIONS: { inOffer: RegExp; inCopy: RegExp; label: string }[] = [
  { inOffer: /\bnott[ei]\b/i, inCopy: /\bnott[ei]\b|\bnotturn/i, label: 'a notte' },
  { inOffer: /multi-?giorno|più giorni/i, inCopy: /multi-?giorno|più giorni|\d\s*\/\s*\d\s*giorni/i, label: 'trasferte di più giorni' },
]

/**
 * An allowance ("indennità") keeps the condition the Job Offer attaches to it: if the offer
 * pays it per night on multi-day trips, copy saying just "+ indennità" or "indennità per le
 * trasferte" generalises it and is rejected.
 */
export function benefitConditionIssues(fields: TextField[], offer: JobOfferPayload): ContentIssue[] {
  const offerLines = `${offer.compensation_package}\n${offer.location_and_hours}`
    .split('\n')
    .filter((line) => ALLOWANCE.test(line))
  const conditions = ALLOWANCE_CONDITIONS.filter((c) => offerLines.some((line) => c.inOffer.test(line)))
  if (conditions.length === 0) return []
  const labels = conditions.map((c) => c.label).join(', ')
  return fields
    .filter(({ text }) => ALLOWANCE.test(text) && !conditions.some((c) => c.inCopy.test(text)))
    .map(({ path }) => ({
      path,
      message: `Indennità senza la sua condizione: la Job Offer la prevede solo per ${labels}. Scrivila con la condizione o non citarla.`,
    }))
}

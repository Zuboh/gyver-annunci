// Domain types. Names follow GLOSSARY.md. Content shapes (BriefContent, Creative,
// per-kind channel content) are inferred from the Zod schemas, which are their single source.
import type { BriefContent } from './brief-schema'
import type { ChannelContent } from './content-schemas'

export type { BriefContent } from './brief-schema'
export type {
  ChannelContent,
  Creative,
  JobBoardContent,
  MessagingContent,
  Section,
  SocialAdContent,
} from './content-schemas'

export const CHANNEL_KINDS = ['job_board', 'social_ad', 'messaging'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

export const FORMATS = ['text', 'image', 'image_text'] as const
export type Format = (typeof FORMATS)[number]

export const AD_STATUSES = ['draft', 'ready', 'published', 'paused', 'archived'] as const
export type AdStatus = (typeof AD_STATUSES)[number]

export const ORIGINS = ['llm', 'manual'] as const
export type Origin = (typeof ORIGINS)[number]

/** ISO-8601 UTC timestamp, e.g. "2026-11-09T12:00:00.000Z". */
export type Timestamp = string

/** A problem found in a piece of content. `message` is Italian (shown to the Team Delivery). */
export interface ContentIssue {
  /** Dot path into the content, array indexes as numbers (e.g. "sections.1.bullets.0"). "" = root. */
  path: string
  message: string
}

// ---------------------------------------------------------------------------
// Job Offer (external, read-only input). The payload keeps the external snake_case schema.
// ---------------------------------------------------------------------------

export interface JobOfferPayload {
  job_offer_id: string
  title: string
  company_name: string
  status: string
  created_at: Timestamp
  location: {
    street_name: string
    street_number: string
    postal_code: string
    locality: string
    province: string
    province_code: string
    region: string
    country_code: string
  }
  contract_type: string
  min_exp_years: number | null
  max_exp_years: number | null
  ral_min: number | null
  ral_max: number | null
  currency: string
  required_skills: string[]
  role_description: string
  location_and_hours: string
  company_description: string
  requirements_description: string
  compensation_package: string
}

export interface JobOffer {
  id: string
  title: string
  companyName: string
  status: string
  /** Full external payload, including internal non-publishable data. Never sent to channel prompts. */
  payload: JobOfferPayload
}

/** List view of a Job Offer: the query columns only, without the internal payload. */
export type JobOfferSummary = Omit<JobOffer, 'payload'>

// ---------------------------------------------------------------------------
// Brief: publishable facts extracted once per Job Offer. Append-only; latest = in use.
// ---------------------------------------------------------------------------

export interface Brief {
  id: string
  jobOfferId: string
  content: BriefContent
  model: string
  promptVersion: string
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// Channel catalog (data, ADR 0001)
// ---------------------------------------------------------------------------

export interface Channel {
  /** Stable slug, e.g. "indeed", "instagram", "tiktok", "whatsapp". */
  id: string
  name: string
  kind: ChannelKind
  /** Italian tone guidelines passed to the channel prompt. */
  toneGuidelines: string
}

/**
 * Constraints of a Channel × Format, stored as JSON in channel_formats.constraints.
 * Field paths use dots and `*` for "every array element", matching ContentIssue.path
 * with indexes replaced by `*` (e.g. "sections.*.bullets.*", "creative.overlayTexts.*").
 */
export interface ChannelFormatConstraints {
  /** Max characters per string field path. */
  maxLength: Record<string, number>
  /** Max items per array field path. */
  maxItems: Record<string, number>
  /** Field paths that must be present and non-empty (non-null, non-blank, non-empty array). */
  requiredFields: string[]
  /** Required image size when the Format has an image (creative.width/height must match); null for text. */
  image: { width: number; height: number; aspectRatio: string } | null
}

export interface ChannelFormat {
  channelId: string
  format: Format
  constraints: ChannelFormatConstraints
}

// ---------------------------------------------------------------------------
// Ad → Variant → Version
// ---------------------------------------------------------------------------

/** Where the Ad says the job is. Free label for the public + geographic data. Never a street address. */
export interface AdLocation {
  /** Shown to the public, e.g. "Orzinuovi (BS) + trasferte". */
  label: string
  municipality: string | null
  province: string | null
  /** Two-letter Italian province code, e.g. "BS". */
  provinceCode: string | null
  region: string | null
  /** ISO 3166-1 alpha-2, e.g. "IT". */
  country: string
}

export interface Ad {
  id: string
  jobOfferId: string
  channelId: string
  format: Format
  status: AdStatus
  location: AdLocation
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Variant {
  id: string
  adId: string
  /** "A", "B", "C"… unique within the Ad. */
  label: string
  angle: string
  /** false = discarded: kept in history, no longer considered. */
  active: boolean
  createdAt: Timestamp
}

/** Immutable state of a Variant's content (ADR 0002). Current = highest number. */
export type Version = {
  id: string
  variantId: string
  /** 1, 2, 3… per Variant. */
  number: number
  content: ChannelContent
  createdAt: Timestamp
} & (
  | { origin: 'llm'; briefId: string; model: string; promptVersion: string }
  | { origin: 'manual'; briefId: null; model: null; promptVersion: null }
)

// ---------------------------------------------------------------------------
// Generation runs: one row per LLM attempt (ok, invalid or error).
// ---------------------------------------------------------------------------

export type GenerationKind = 'brief' | 'variant'
export type GenerationOutcome = 'ok' | 'invalid' | 'error'

export interface GenerationRun {
  id: string
  kind: GenerationKind
  /** kind "brief" → job offer id; kind "variant" → ad id. */
  ref: string
  /** 1 = first try, 2 = the single retry. */
  attempt: number
  outcome: GenerationOutcome
  /** Validation issues (invalid) or one root issue with the error message (error); [] when ok. */
  issues: ContentIssue[]
  /** Raw LLM response text; null when the call failed before a response. */
  rawResponse: string | null
  createdAt: Timestamp
}

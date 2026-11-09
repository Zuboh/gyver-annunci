// Single validation entry point for Variant content, used for both LLM output and manual
// Versions (SPEC "Validazione contenuto"). Pure: no DB, no LLM. Issue messages are Italian.
import { z } from 'zod'
import { contentSchemaFor } from '../domain/content-schemas'
import type {
  Channel,
  ChannelContent,
  ChannelFormat,
  ContentIssue,
  JobOffer,
} from '../domain/types'

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

  // TODO(validation): ChannelFormat constraints — ctx.channelFormat.constraints
  //   (maxLength, maxItems, requiredFields incl. non-blank strings, image size vs creative).
  // TODO(validation): business rules — creative non-null iff format !== 'text';
  //   highlightWord contained in overlayTexts; no exact street address on social_ad/messaging
  //   (ctx.jobOffer.payload.location); salary coherent with ral_min/ral_max.
  return { ok: true, content: parsed.data }
}

// Content shape per channel kind (ADR 0001: channels are data, content shape is code).
// One schema per ChannelKind, shared by OpenAI structured outputs and by validation of
// manual Versions. Structured outputs rule: every field required, "optional" = .nullable().
// Lengths and image sizes are NOT here: they are ChannelFormat constraints (data).
import { z } from 'zod'
import type { ChannelKind } from './types'

/** A heading with short bullet points (Indeed description, WhatsApp card). */
export const sectionSchema = z.object({
  heading: z.string(),
  bullets: z.array(z.string()).min(1),
})

/**
 * Structured description of a Variant's image (not the image file).
 * Required (non-null) when the Ad's Format is `image` or `image_text`, null for `text`:
 * that is a business rule enforced by validateContent, not by the schema.
 */
export const creativeSchema = z.object({
  /** Text lines over the image, top to bottom. */
  overlayTexts: z.array(z.string()).min(1),
  /** Word to highlight; must appear in one of overlayTexts. */
  highlightWord: z.string().nullable(),
  /** What the photo shows, e.g. "tecnico con casco davanti a pannelli fotovoltaici". */
  photoSubject: z.string(),
  /** Pixels; must match ChannelFormat.constraints.image. */
  width: z.number().int().min(1),
  height: z.number().int().min(1),
})

/** Job board (Indeed): full text plus the structured fields the board requires. */
export const jobBoardContentSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  /** Ad address field of the job board ("Indirizzo annuncio"); the exact address is allowed here. */
  address: z.string(),
  skills: z.array(z.string()),
  /** e.g. "3-5 anni". */
  experience: z.string(),
  contractType: z.string().nullable(),
  /** Salary as shown, e.g. "RAL da 32.000 a 38.000 €"; must match the Job Offer. */
  salary: z.string().nullable(),
  /** Job description, as headed sections of bullets. */
  description: z.array(sectionSchema).min(1),
  creative: creativeSchema.nullable(),
})

/** Social ads (Instagram, TikTok): overlay text lives in the Creative, plus the post caption. */
export const socialAdContentSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  callToAction: z.string().nullable(),
  creative: creativeSchema.nullable(),
})

/** Messaging (WhatsApp): A4 card with title, short badges and bulleted sections. */
export const messagingContentSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  /** Short labels, e.g. "RAL iniziale da €38'000 + indennità", "Tempo indeterminato". */
  badges: z.array(z.string()).min(1),
  sections: z.array(sectionSchema).min(1),
  creative: creativeSchema.nullable(),
})

export const contentSchemas = {
  job_board: jobBoardContentSchema,
  social_ad: socialAdContentSchema,
  messaging: messagingContentSchema,
} as const satisfies Record<ChannelKind, z.ZodType>

export function contentSchemaFor<K extends ChannelKind>(kind: K): (typeof contentSchemas)[K] {
  return contentSchemas[kind]
}

export type Section = z.infer<typeof sectionSchema>
export type Creative = z.infer<typeof creativeSchema>
export type JobBoardContent = z.infer<typeof jobBoardContentSchema>
export type SocialAdContent = z.infer<typeof socialAdContentSchema>
export type MessagingContent = z.infer<typeof messagingContentSchema>
export type ChannelContent = JobBoardContent | SocialAdContent | MessagingContent

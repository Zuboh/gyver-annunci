// Brief content schema (ADR 0003). Used for OpenAI structured outputs and to type Brief.content.
// Structured outputs rule: every field is required; "optional" is expressed with .nullable().
import { z } from 'zod'

export const briefContentSchema = z.object({
  /** Publishable job title, e.g. "Tecnico Fotovoltaico". */
  roleTitle: z.string(),
  /** Publishable company presentation (no internal data). */
  companyPitch: z.string(),
  contractType: z.string().nullable(),
  /** Gross yearly salary (RAL) that may be shown; must match the Job Offer. */
  salary: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string(),
    })
    .nullable(),
  experience: z.object({
    minYears: z.number().int().nullable(),
    maxYears: z.number().int().nullable(),
  }),
  skills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.string()),
  benefits: z.array(z.string()),
  /** Strongest hooks for a technician, used to pick and develop angles. */
  sellingPoints: z.array(z.string()),
  /** Geographic area that may be shown (never the street address), e.g. "Orzinuovi (BS)". */
  workArea: z.string(),
  /**
   * Full work site address ("Via Artigianato, 27, 25034 Orzinuovi BS"). Only job_board
   * content may show it (Indeed "Indirizzo annuncio"); forbidden on social_ad and messaging.
   */
  siteAddress: z.string().nullable(),
  travel: z.string().nullable(),
  /** Facts present in the Job Offer that must not appear in external copy. */
  doNotSay: z.array(z.string()),
  /** Suggested angles (e.g. "carriera", "stipendio", "multinazionale"). */
  suggestedAngles: z.array(z.string()),
})

export type BriefContent = z.infer<typeof briefContentSchema>

// Read models and inputs of the Ads use cases (the shapes the API returns and accepts).
import type { Ad, AdLocation, AdStatus, Format, Variant, Version } from '../domain/types'
import type { ErrorCode } from '../http/errors'

export interface AdFilters {
  jobOfferId?: string
  channelId?: string
  status?: AdStatus
}

export type AdListItem = Ad & { activeVariantCount: number }

export type VariantWithCurrentVersion = Variant & { currentVersion: Version }

export type AdDetail = Ad & { variants: VariantWithCurrentVersion[] }

export interface CreateAdInput {
  jobOfferId: string
  channelId: string
  format: Format
  /** Replaces the default (derived from the Job Offer site) as a whole when given. */
  location?: AdLocation
  /** 1–3 distinct angles; default: the first suggested angle. */
  angles?: string[]
}

/** An angle whose Variant could not be generated, with the same error body the API would return. */
export interface FailedAngle {
  angle: string
  error: { code: ErrorCode; message: string; details?: unknown }
}

/** The Ad and the Variants that succeeded are saved when some angles fail; if all fail, nothing is saved and the first error is thrown. */
export interface CreateAdResult {
  ad: AdDetail
  failedAngles: FailedAngle[]
}

export interface UpdateAdInput {
  status?: AdStatus
  /** Replaces the whole Location. */
  location?: AdLocation
}

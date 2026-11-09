import type { ChannelKind } from '../../domain/types'
import { jobBoardPrompt } from './job-board'
import { messagingPrompt } from './messaging'
import { socialAdPrompt } from './social-ad'
import type { VariantPrompt } from './types'

export { briefPrompt } from './brief'
export type { BriefPrompt, PromptMessages, VariantPrompt } from './types'

const variantPrompts: Record<ChannelKind, VariantPrompt> = {
  job_board: jobBoardPrompt,
  social_ad: socialAdPrompt,
  messaging: messagingPrompt,
}

export function variantPromptFor(kind: ChannelKind): VariantPrompt {
  return variantPrompts[kind]
}

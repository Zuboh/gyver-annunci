import type { GenerateBriefInput, GenerateVariantContentInput } from '../llm-client'

export interface PromptMessages {
  system: string
  user: string
}

/** A versioned prompt. `version` (e.g. "brief@v1") is stored on every Brief and Version it produces. */
export interface Prompt<I> {
  version: string
  build(input: I): PromptMessages
}

export type BriefPrompt = Prompt<GenerateBriefInput>
export type VariantPrompt = Prompt<GenerateVariantContentInput>

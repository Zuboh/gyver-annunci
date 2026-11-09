// Suggested angles (SPEC user story 15). Free text is allowed too: these are only suggestions.
export const SUGGESTED_ANGLES = ['carriera', 'stipendio', 'multinazionale'] as const

/** Used when an Ad is created without angles. */
export const DEFAULT_ANGLE: string = SUGGESTED_ANGLES[0]

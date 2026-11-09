// Ids of rows created by the app (job offers and channels use slugs from the seed instead).

export type IdPrefix = 'brief' | 'ad' | 'var' | 'ver' | 'run'

/** e.g. newId('ad') → "ad_3f2b…". The prefix makes ids readable in logs and error details. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`
}

// Generates one sample per allowed Channel × Format for jo_001 with the real OpenAI model and
// writes them to docs/samples/<prompt-version>/<channel>-<format>.json (content + Brief + runs).
// Works on a freshly seeded in-memory database: data/gyver.db is never touched.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { listChannelsWithFormats } from '../src/catalog/channel-catalog'
import { findJobOffer } from '../src/db/job-offers'
import { openDatabase } from '../src/db/open-database'
import { seed } from '../src/db/seed'
import type { Ad } from '../src/domain/types'
import { createGenerationService } from '../src/generation/generation-service'
import { AppError } from '../src/http/errors'
import { createOpenAiLlmClient } from '../src/llm/openai-llm-client'

const JOB_OFFER_ID = 'jo_001'
const SAMPLES_DIR = 'docs/samples'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error(
    'OPENAI_API_KEY non impostata: impossibile generare i campioni.\n' +
      'OPENAI_API_KEY is not set: cannot generate samples. Run: OPENAI_API_KEY=sk-... bun run gen:sample',
  )
  process.exit(1)
}

const db = openDatabase(':memory:')
seed(db)
const service = createGenerationService({
  db,
  llm: createOpenAiLlmClient({ apiKey, model: process.env.OPENAI_MODEL }),
})

const jobOffer = findJobOffer(db, JOB_OFFER_ID)
if (!jobOffer) {
  console.error(`Job Offer ${JOB_OFFER_ID} assente dal seed.`)
  process.exit(1)
}

const brief = await service.getOrCreateBrief(JOB_OFFER_ID).catch((err: unknown) => {
  if (!(err instanceof AppError)) throw err
  console.error(`ERR brief: ${err.message}`, err.details ?? '')
  process.exit(1)
})
// Angles rotate across samples so the judge sees different angles, not only the first one.
const angles = brief.content.suggestedAngles.length > 0 ? brief.content.suggestedAngles : ['carriera']
let sampleIndex = 0
const { location } = jobOffer.payload
const adLocation: Ad['location'] = {
  label: `${location.locality} (${location.province_code})`,
  municipality: location.locality,
  province: location.province,
  provinceCode: location.province_code,
  region: location.region,
  country: location.country_code,
}

const runsQuery = db.query<Record<string, unknown>, { ref: string }>(
  `SELECT attempt, outcome, issues, created_at FROM generation_runs WHERE kind = 'variant' AND ref = $ref ORDER BY created_at`,
)

let failures = 0
for (const channel of listChannelsWithFormats(db)) {
  for (const { format } of channel.formats) {
    const now = new Date().toISOString()
    const angle = angles[sampleIndex++ % angles.length] ?? 'carriera'
    // Transient Ad: generation only needs its fields; nothing is persisted except generation_runs.
    const ad: Ad = {
      id: `sample_${channel.id}_${format}`,
      jobOfferId: JOB_OFFER_ID,
      channelId: channel.id,
      format,
      status: 'draft',
      location: adLocation,
      createdAt: now,
      updatedAt: now,
    }
    try {
      const generated = await service.generateVariantContent({ ad, angle })
      const dir = join(SAMPLES_DIR, generated.promptVersion)
      mkdirSync(dir, { recursive: true })
      const file = join(dir, `${channel.id}-${format}.json`)
      const sample = {
        jobOfferId: JOB_OFFER_ID,
        channel: channel.id,
        format,
        angle,
        location: adLocation,
        model: generated.model,
        promptVersion: generated.promptVersion,
        generatedAt: now,
        brief: { id: brief.id, model: brief.model, promptVersion: brief.promptVersion, content: brief.content },
        content: generated.content,
        runs: runsQuery.all({ ref: ad.id }).map((r) => ({ ...r, issues: JSON.parse(String(r.issues)) })),
      }
      writeFileSync(file, `${JSON.stringify(sample, null, 2)}\n`)
      console.log(`ok  ${file}`)
    } catch (err) {
      if (!(err instanceof AppError)) throw err
      failures++
      console.error(`ERR ${channel.id}-${format}: ${err.message}`, err.details ?? '')
      for (const run of runsQuery.all({ ref: ad.id })) console.error(`    attempt ${run.attempt} ${run.outcome}: ${run.issues}`)
    }
  }
}

process.exit(failures > 0 ? 1 : 0)

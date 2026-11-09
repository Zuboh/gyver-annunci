// Seeds an empty database with jo_001, the channel catalog and the PDF examples as Ads with
// one manual Version each. No-op if jo_001 is already there. Every example is checked with
// validateContent, so the seed can never hold content the API would reject.
import type { Database } from 'bun:sqlite'
import * as repo from '../ads/ad-repository'
import { findChannel, findChannelFormat } from '../catalog/channel-catalog'
import { validateContent } from '../validation/validate-content'
import { findJobOffer } from './job-offers'
import { CHANNEL_FORMATS, CHANNELS, JO_001, SEED_ADS } from './seed-data'

export function seed(db: Database): void {
  if (findJobOffer(db, JO_001.job_offer_id)) return

  db.transaction(() => {
    db.query(
      'INSERT INTO job_offers (id, title, company_name, status, payload) VALUES ($id, $title, $companyName, $status, $payload)',
    ).run({
      id: JO_001.job_offer_id,
      title: JO_001.title,
      companyName: JO_001.company_name,
      status: JO_001.status,
      payload: JSON.stringify(JO_001),
    })

    for (const { id, name, kind, toneGuidelines } of CHANNELS) {
      db.query(
        'INSERT INTO channels (id, name, kind, tone_guidelines) VALUES ($id, $name, $kind, $toneGuidelines)',
      ).run({ id, name, kind, toneGuidelines })
    }
    for (const { channelId, format, constraints } of CHANNEL_FORMATS) {
      db.query(
        'INSERT INTO channel_formats (channel_id, format, constraints) VALUES ($channelId, $format, $constraints)',
      ).run({ channelId, format, constraints: JSON.stringify(constraints) })
    }

    const jobOffer = findJobOffer(db, JO_001.job_offer_id)
    if (!jobOffer) throw new Error('seed: jo_001 not inserted')
    for (const example of SEED_ADS) {
      const channel = findChannel(db, example.channelId)
      const channelFormat = findChannelFormat(db, example.channelId, example.format)
      if (!channel || !channelFormat) throw new Error(`seed: ${example.channelId}/${example.format} not in catalog`)
      const result = validateContent(example.content, { channel, channelFormat, jobOffer })
      if (!result.ok) {
        throw new Error(`seed: ${example.channelId} example is invalid: ${JSON.stringify(result.issues)}`)
      }

      const ad = repo.insertAd(db, {
        jobOfferId: jobOffer.id,
        channelId: example.channelId,
        format: example.format,
        location: example.location,
      })
      repo.updateAd(db, ad, { status: example.status, location: example.location })
      const variant = repo.insertVariant(db, ad.id, example.angle)
      repo.insertVersion(db, variant.id, result.content, repo.MANUAL)
    }
  })()
}

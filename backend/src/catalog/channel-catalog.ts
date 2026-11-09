// Channel catalog (ADR 0001): Channels and allowed Channel × Format combinations are data.
import type { Database } from 'bun:sqlite'
import type { Channel, ChannelFormat, ChannelFormatConstraints, ChannelKind, Format } from '../domain/types'

interface ChannelRow {
  id: string
  name: string
  kind: ChannelKind
  tone_guidelines: string
}

interface ChannelFormatRow {
  channel_id: string
  format: Format
  constraints: string
}

const toChannel = (row: ChannelRow): Channel => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  toneGuidelines: row.tone_guidelines,
})

const toChannelFormat = (row: ChannelFormatRow): ChannelFormat => ({
  channelId: row.channel_id,
  format: row.format,
  constraints: JSON.parse(row.constraints) as ChannelFormatConstraints,
})

export function findChannel(db: Database, id: string): Channel | null {
  const row = db.query('SELECT * FROM channels WHERE id = $id').get({ id }) as ChannelRow | null
  return row && toChannel(row)
}

/** null when the Channel × Format combination is not allowed (or the channel does not exist). */
export function findChannelFormat(db: Database, channelId: string, format: Format): ChannelFormat | null {
  const row = db
    .query('SELECT * FROM channel_formats WHERE channel_id = $channelId AND format = $format')
    .get({ channelId, format }) as ChannelFormatRow | null
  return row && toChannelFormat(row)
}

export function listChannelsWithFormats(db: Database): Array<Channel & { formats: ChannelFormat[] }> {
  const channels = (db.query('SELECT * FROM channels ORDER BY id').all() as ChannelRow[]).map(toChannel)
  const formats = (
    db.query('SELECT * FROM channel_formats ORDER BY channel_id, format').all() as ChannelFormatRow[]
  ).map(toChannelFormat)
  return channels.map((channel) => ({
    ...channel,
    formats: formats.filter((f) => f.channelId === channel.id),
  }))
}

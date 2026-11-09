// Channel catalog with allowed Formats and constraints, plus angle suggestions for the UI.
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { SUGGESTED_ANGLES } from '../ads/angles'
import { listChannelsWithFormats } from '../catalog/channel-catalog'

export function channelsRoutes(deps: { db: Database }) {
  return new Elysia()
    .get('/api/channels', () => listChannelsWithFormats(deps.db))
    .get('/api/angles', () => SUGGESTED_ANGLES)
}

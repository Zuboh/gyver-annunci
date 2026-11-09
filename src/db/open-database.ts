// Opens a SQLite connection ready for the app: foreign keys on, schema applied.
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'

const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

/** `path` is a file path or ':memory:'. strict: named params bind without prefix and missing ones throw. */
export function openDatabase(path: string): Database {
  const db = new Database(path, { strict: true })
  // Per-connection setting: SQLite ignores foreign keys unless enabled on every open.
  db.run('PRAGMA foreign_keys = ON;')
  if (path !== ':memory:') db.run('PRAGMA journal_mode = WAL;')
  db.run(schemaSql)
  return db
}

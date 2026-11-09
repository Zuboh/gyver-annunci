// Deletes and recreates the database file from src/db/schema.sql.
import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { openDatabase } from '../src/db/open-database'

const path = process.env.DB_PATH ?? 'data/gyver.db'

for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${path}${suffix}`, { force: true })
mkdirSync(dirname(path), { recursive: true })

const db = openDatabase(path)
// TODO(seed): call the seed here once src/db/seed.ts exists, e.g. `seed(db)`.
// Leave a self-contained file to commit: DELETE mode checkpoints the WAL and drops -wal/-shm.
// openDatabase() turns WAL back on at the next open.
db.run('PRAGMA journal_mode = DELETE;')
db.close()
console.log(`Database ricreato: ${path}`)

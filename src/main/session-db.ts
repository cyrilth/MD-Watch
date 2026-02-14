/**
 * Session persistence using SQLite (3.1, 3.2).
 * DB file in user data dir; table session (key, value).
 */
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const DB_FILENAME = 'session.db'

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME)
}

let db: ReturnType<typeof Database> | null = null

function getDb(): ReturnType<typeof Database> {
  if (db) return db
  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS session (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
  return db
}

/** Read all session keys from DB; return object (values parsed from JSON). (3.3) */
export function readSessionFromDb(): Record<string, unknown> {
  const database = getDb()
  const rows = database.prepare('SELECT key, value FROM session').all() as { key: string; value: string }[]
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value)
    } catch {
      out[row.key] = row.value
    }
  }
  return out
}

/** Merge data into session DB (insert or replace per key). (3.4) */
export function writeSessionToDb(data: Record<string, unknown>): void {
  const database = getDb()
  const stmt = database.prepare('INSERT OR REPLACE INTO session (key, value) VALUES (?, ?)')
  const insertMany = database.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      stmt.run(key, JSON.stringify(value))
    }
  })
  insertMany(Object.entries(data))
}

/** Path to the session DB file (for export: copy this file). */
export function getSessionDbPath(): string {
  return getDbPath()
}

/** Close DB (e.g. on app quit). */
export function closeSessionDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

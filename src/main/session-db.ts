/**
 * Session persistence using SQLite (3.1, 3.2).
 * DB file in user data dir; table session (key, value).
 * Falls back to session.json if better-sqlite3 fails to load (e.g. NODE_MODULE_VERSION mismatch).
 */
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let Database: ReturnType<typeof require> | null = null
try {
  Database = require('better-sqlite3')
} catch {
  // Native module failed (e.g. built for different Node/Electron). Use JSON fallback.
}

const DB_FILENAME = 'session.db'
const JSON_FALLBACK_FILENAME = 'session.json'

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME)
}

function getJsonPath(): string {
  return path.join(app.getPath('userData'), JSON_FALLBACK_FILENAME)
}

let db: ReturnType<typeof require> | null = null
let useJsonFallback = false

function getDb(): ReturnType<typeof require> | null {
  if (useJsonFallback) return null
  if (db) return db
  if (!Database) {
    useJsonFallback = true
    return null
  }
  try {
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
  } catch {
    useJsonFallback = true
    return null
  }
}

function readJsonSession(): Record<string, unknown> {
  try {
    const data = fs.readFileSync(getJsonPath(), 'utf-8')
    return JSON.parse(data) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJsonSession(data: Record<string, unknown>): void {
  const dir = path.dirname(getJsonPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getJsonPath(), JSON.stringify(data, null, 2), 'utf-8')
}

/** Read all session keys from DB; return object (values parsed from JSON). (3.3) */
export function readSessionFromDb(): Record<string, unknown> {
  const database = getDb()
  if (!database) return readJsonSession()
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
  if (!database) {
    const current = readJsonSession()
    writeJsonSession({ ...current, ...data })
    return
  }
  const stmt = database.prepare('INSERT OR REPLACE INTO session (key, value) VALUES (?, ?)')
  const insertMany = database.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      stmt.run(key, JSON.stringify(value))
    }
  })
  insertMany(Object.entries(data))
}

/** Path to the session DB file (for export: copy this file). When using JSON fallback, returns JSON path. */
export function getSessionDbPath(): string {
  return useJsonFallback ? getJsonPath() : getDbPath()
}

/** Close DB (e.g. on app quit). */
export function closeSessionDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

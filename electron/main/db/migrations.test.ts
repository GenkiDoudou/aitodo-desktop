import { describe, expect, it } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from './migrations'

describe('migrations v25 triaged_at', () => {
  it('adds triaged_at column to tasks', () => {
    const db = new BetterSqlite3(':memory:')
    runMigrations(db)
    const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[]
    expect(cols.some((c) => c.name === 'triaged_at')).toBe(true)
  })

  it('adds quadrant_options_json to task_views (v26)', () => {
    const db = new BetterSqlite3(':memory:')
    runMigrations(db)
    const cols = db.prepare(`PRAGMA table_info(task_views)`).all() as { name: string }[]
    expect(cols.some((c) => c.name === 'quadrant_options_json')).toBe(true)
  })
})

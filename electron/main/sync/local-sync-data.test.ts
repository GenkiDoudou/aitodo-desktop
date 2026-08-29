import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations'
import {
  clearLocalSyncData,
  hasLocalSyncableData,
  shouldPromptLocalDataPolicy
} from './local-sync-data'

describe('local-sync-data', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('hasLocalSyncableData is false on empty db', () => {
    expect(hasLocalSyncableData(db)).toBe(false)
  })

  it('shouldPrompt when user switches and local has tasks', () => {
    db.prepare(
      `INSERT INTO tasks (id, title, status, sort_order, created_at, updated_at, sync_version)
       VALUES ('t1', 'x', 'TODO', 0, '2026-01-01', '2026-01-01', 1)`
    ).run()
    expect(shouldPromptLocalDataPolicy(db, 'user-a', 'user-b')).toBe(true)
  })

  it('should not prompt for same userId re-login', () => {
    db.prepare(
      `INSERT INTO tasks (id, title, status, sort_order, created_at, updated_at, sync_version)
       VALUES ('t1', 'x', 'TODO', 0, '2026-01-01', '2026-01-01', 1)`
    ).run()
    expect(shouldPromptLocalDataPolicy(db, 'user-a', 'user-a')).toBe(false)
  })

  it('clearLocalSyncData removes tasks and outbox', () => {
    db.prepare(
      `INSERT INTO tasks (id, title, status, sort_order, created_at, updated_at, sync_version)
       VALUES ('t1', 'x', 'TODO', 0, '2026-01-01', '2026-01-01', 1)`
    ).run()
    clearLocalSyncData(db)
    expect(hasLocalSyncableData(db)).toBe(false)
  })
})

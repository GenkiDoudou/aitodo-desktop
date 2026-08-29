import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runMigrations } from '../db/migrations'
import { SyncOutbox } from '../db/sync-outbox'
import { mergeSyncPreferences } from '@shared/sync-preferences'
import { enqueueMissingLocalEntities } from './sync-enqueue-missing'

describe('enqueueMissingLocalEntities', () => {
  let db: Database.Database
  let dataDir: string

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    dataDir = mkdtempSync(join(tmpdir(), 'aitodo-sync-'))
  })

  afterEach(() => {
    db.close()
    rmSync(dataDir, { recursive: true, force: true })
  })

  function insertCategory(id: string, name: string): void {
    db.prepare(
      `INSERT INTO categories (id, name, color, sort_order, keywords, created_at, updated_at)
       VALUES (?, ?, '#000', 0, '[]', '2026-07-01T00:00:00', '2026-07-01T00:00:00')`
    ).run(id, name)
  }

  function insertTask(id: string, title: string): void {
    db.prepare(
      `INSERT INTO tasks (
         id, title, description, status, category_id, parent_id,
         start_at, due_at, remind_at, completed_at, priority, sort_order,
         created_at, updated_at, deleted_at, sync_version
       ) VALUES (?, ?, NULL, 'TODO', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0,
                 '2026-07-01T00:00:00', '2026-07-01T00:00:00', NULL, 1)`
    ).run(id, title)
  }

  function insertNote(id: string, content: string): void {
    db.prepare(
      `INSERT INTO widget_notes (id, content, color, pinned, created_at, updated_at)
       VALUES (?, ?, 'yellow', 0, '2026-07-01T00:00:00', '2026-07-01T00:00:00')`
    ).run(id, content)
  }

  const prefsNoConfig = mergeSyncPreferences({ syncConfig: false })

  it('enqueues widget notes that were never in outbox', () => {
    insertNote('n1', 'hello')
    insertNote('n2', 'world')
    const outbox = new SyncOutbox(db)
    const id = outbox.record({
      entityType: 'widget_note',
      entityId: 'n1',
      operation: 'upsert',
      payload: { id: 'n1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(id, 'pushed')

    expect(enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)).toBe(1)
    expect(outbox.hasPendingOrPushed('widget_note', 'n2')).toBe(true)
  })

  it('enqueues local categories and tasks that were never in outbox', () => {
    insertCategory('c1', '工作')
    insertCategory('c2', '生活')
    insertTask('t1', '任务一')
    insertTask('t2', '任务二')

    const outbox = new SyncOutbox(db)
    const existing = outbox.record({
      entityType: 'task',
      entityId: 't1',
      operation: 'upsert',
      payload: { id: 't1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(existing, 'pushed')

    outbox.record({
      entityType: 'category',
      entityId: 'c1',
      operation: 'upsert',
      payload: { id: 'c1', name: '工作' },
      clientSyncVersion: 1
    })

    const n = enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)
    expect(n).toBe(2) // c2 + t2
    expect(outbox.countPending()).toBe(3)
    expect(outbox.hasPendingOrPushed('category', 'c2')).toBe(true)
    expect(outbox.hasPendingOrPushed('task', 't2')).toBe(true)
    expect(outbox.hasPendingOrPushed('task', 't1')).toBe(true)
  })

  it('is idempotent when everything already pending or pushed', () => {
    insertCategory('c1', '工作')
    insertTask('t1', '任务一')
    enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)
    expect(enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)).toBe(0)
  })

  it('re-enqueues entities that were only rejected', () => {
    insertTask('t1', '任务一')
    const outbox = new SyncOutbox(db)
    const id = outbox.record({
      entityType: 'task',
      entityId: 't1',
      operation: 'upsert',
      payload: { id: 't1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(id, 'rejected')

    expect(enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)).toBe(1)
    expect(outbox.countPending()).toBe(1)
  })

  it('skips disabled sync scopes', () => {
    insertCategory('c1', '工作')
    insertNote('n1', 'note')
    const prefs = mergeSyncPreferences({
      syncTasks: false,
      syncConfig: false,
      syncNotes: false
    })
    expect(enqueueMissingLocalEntities(db, prefs, dataDir)).toBe(0)
  })

  it('forceRepush re-enqueues already pushed entities for ownership change', () => {
    insertTask('t1', '任务一')
    insertCategory('c1', '工作')
    const outbox = new SyncOutbox(db)
    const tid = outbox.record({
      entityType: 'task',
      entityId: 't1',
      operation: 'upsert',
      payload: { id: 't1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(tid, 'pushed')
    const cid = outbox.record({
      entityType: 'category',
      entityId: 'c1',
      operation: 'upsert',
      payload: { id: 'c1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(cid, 'pushed')

    expect(enqueueMissingLocalEntities(db, prefsNoConfig, dataDir)).toBe(0)
    const n = enqueueMissingLocalEntities(db, prefsNoConfig, dataDir, { forceRepush: true })
    expect(n).toBe(2)
    expect(outbox.countPending()).toBe(2)
    expect(outbox.hasPendingOrPushed('task', 't1')).toBe(true)
    expect(outbox.hasPendingOrPushed('category', 'c1')).toBe(true)
  })
})

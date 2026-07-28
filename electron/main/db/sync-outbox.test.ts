import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'
import { SyncOutbox } from './sync-outbox'

describe('SyncOutbox', () => {
  let db: Database.Database
  let outbox: SyncOutbox

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    outbox = new SyncOutbox(db)
  })

  afterEach(() => {
    db.close()
  })

  it('records and lists pending in same transaction as business write', () => {
    outbox.runInTransaction(() => {
      db.prepare(
        `INSERT INTO categories (id, name, color, sort_order, created_at, updated_at)
         VALUES ('c1', '工作', '#000', 0, '2026-07-20T12:00:00', '2026-07-20T12:00:00')`
      ).run()
      outbox.record({
        entityType: 'category',
        entityId: 'c1',
        operation: 'upsert',
        payload: { id: 'c1', name: '工作' },
        clientSyncVersion: 1
      })
    })

    const pending = outbox.listPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].entityId).toBe('c1')
    expect(pending[0].status).toBe('pending')
    expect(outbox.countPending()).toBe(1)
  })

  it('marks pushed and discarded', () => {
    const id = outbox.record({
      entityType: 'task',
      entityId: 't1',
      operation: 'upsert',
      payload: { id: 't1' },
      clientSyncVersion: 1
    })
    outbox.markStatus(id, 'pushed')
    expect(outbox.countPending()).toBe(0)
    expect(outbox.listPending()).toHaveLength(0)

    const id2 = outbox.record({
      entityType: 'task',
      entityId: 't2',
      operation: 'delete',
      payload: { id: 't2' },
      clientSyncVersion: 2
    })
    outbox.markStatus(id2, 'discarded')
    expect(outbox.countPending()).toBe(0)
  })
})

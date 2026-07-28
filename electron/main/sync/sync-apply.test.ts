import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import type { SyncPullChange } from '@shared/sync-protocol'
import { applyRemoteChange, sortPullChanges } from './sync-apply'
import { isServerWinningConflict } from '@shared/sync-protocol'
import { runMigrations } from '../db/migrations'
import { WidgetNoteRepository } from '../db/widget-note-repository'

describe('sync-apply order and LWW', () => {
  it('sorts pull changes by entity dependency then revision', () => {
    const changes: SyncPullChange[] = [
      {
        revision: 3,
        entityType: 'task',
        entityId: 't1',
        operation: 'upsert',
        payload: {},
        serverUpdatedAt: '2026-07-20T12:00:00Z',
        originDeviceId: null
      },
      {
        revision: 1,
        entityType: 'category',
        entityId: 'c1',
        operation: 'upsert',
        payload: {},
        serverUpdatedAt: '2026-07-20T12:00:00Z',
        originDeviceId: null
      },
      {
        revision: 2,
        entityType: 'task',
        entityId: 't0',
        operation: 'upsert',
        payload: {},
        serverUpdatedAt: '2026-07-20T12:00:00Z',
        originDeviceId: null
      }
    ]
    const sorted = sortPullChanges(changes)
    expect(sorted.map((c) => c.entityId)).toEqual(['c1', 't0', 't1'])
  })

  it('LWW equal updatedAt means server wins', () => {
    expect(isServerWinningConflict('2026-07-20T12:00:00', '2026-07-20T12:00:00')).toBe(true)
  })
})

describe('applyRemoteChange widget_note', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('upserts and deletes widget notes from pull', () => {
    applyRemoteChange(
      db,
      {
        revision: 1,
        entityType: 'widget_note',
        entityId: 'n1',
        operation: 'upsert',
        payload: {
          id: 'n1',
          content: 'hello',
          color: 'blue',
          pinned: true,
          createdAt: '2026-07-01T00:00:00',
          updatedAt: '2026-07-01T00:00:00'
        },
        serverUpdatedAt: '2026-07-01T00:00:00Z',
        originDeviceId: null
      },
      { deviceId: 'dev-1' }
    )
    const repo = new WidgetNoteRepository(db)
    expect(repo.findNote('n1')?.content).toBe('hello')
    expect(repo.findNote('n1')?.color).toBe('blue')

    applyRemoteChange(
      db,
      {
        revision: 2,
        entityType: 'widget_note',
        entityId: 'n1',
        operation: 'delete',
        payload: { id: 'n1', updatedAt: '2026-07-02T00:00:00' },
        serverUpdatedAt: '2026-07-02T00:00:00Z',
        originDeviceId: null
      },
      { deviceId: 'dev-1' }
    )
    expect(repo.findNote('n1')).toBeNull()
  })
})

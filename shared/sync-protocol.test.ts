import { describe, expect, it } from 'vitest'
import {
  compareUpdatedAt,
  isServerWinningConflict,
  isSyncEntityType,
  isSyncOperation,
  validateSyncChangeEnvelope
} from './sync-protocol'

describe('sync-protocol', () => {
  it('accepts known entity types and operations', () => {
    expect(isSyncEntityType('task')).toBe(true)
    expect(isSyncEntityType('category')).toBe(true)
    expect(isSyncEntityType('widget_note')).toBe(true)
    expect(isSyncEntityType('app_settings')).toBe(true)
    expect(isSyncEntityType('task_view')).toBe(true)
    expect(isSyncEntityType('scheduled_summary')).toBe(true)
    expect(isSyncEntityType('unknown')).toBe(false)
    expect(isSyncOperation('upsert')).toBe(true)
    expect(isSyncOperation('delete')).toBe(true)
    expect(isSyncOperation('merge')).toBe(false)
  })

  it('validateSyncChangeEnvelope rejects incomplete envelopes', () => {
    expect(validateSyncChangeEnvelope(null)).toBeTruthy()
    expect(
      validateSyncChangeEnvelope({
        clientChangeId: 'c1',
        entityType: 'task',
        entityId: 't1',
        operation: 'upsert',
        payload: { id: 't1' },
        clientUpdatedAt: '2026-07-20T12:00:00',
        clientSyncVersion: 1
      })
    ).toBeNull()
    expect(
      validateSyncChangeEnvelope({
        clientChangeId: 'c1',
        entityType: 'nope',
        entityId: 't1',
        operation: 'upsert',
        payload: {},
        clientUpdatedAt: '2026-07-20T12:00:00',
        clientSyncVersion: 1
      })
    ).toBe('invalid entityType')
  })

  it('LWW prefers newer updatedAt; equal means server wins', () => {
    expect(compareUpdatedAt('2026-07-20T13:00:00', '2026-07-20T12:00:00')).toBeGreaterThan(0)
    expect(isServerWinningConflict('2026-07-20T12:00:00', '2026-07-20T13:00:00')).toBe(true)
    expect(isServerWinningConflict('2026-07-20T13:00:00', '2026-07-20T12:00:00')).toBe(false)
    expect(isServerWinningConflict('2026-07-20T12:00:00', '2026-07-20T12:00:00')).toBe(true)
  })
})

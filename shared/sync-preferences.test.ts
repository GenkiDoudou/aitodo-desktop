import { describe, expect, it } from 'vitest'
import { isSyncEntityEnabled } from './sync-entity-filter'
import { DEFAULT_SYNC_PREFERENCES, mergeSyncPreferences } from './sync-preferences'

describe('isSyncEntityEnabled', () => {
  it('maps entity types to preference toggles', () => {
    const allOn = DEFAULT_SYNC_PREFERENCES
    expect(isSyncEntityEnabled('task', allOn)).toBe(true)
    expect(isSyncEntityEnabled('category', allOn)).toBe(true)
    expect(isSyncEntityEnabled('widget_note', allOn)).toBe(true)
    expect(isSyncEntityEnabled('app_settings', allOn)).toBe(true)
    expect(isSyncEntityEnabled('task_view', allOn)).toBe(true)
    expect(isSyncEntityEnabled('app_message', allOn)).toBe(true)
    expect(isSyncEntityEnabled('scheduled_summary', allOn)).toBe(true)

    const tasksOff = mergeSyncPreferences({ syncTasks: false })
    expect(isSyncEntityEnabled('task', tasksOff)).toBe(false)
    expect(isSyncEntityEnabled('widget_note', tasksOff)).toBe(true)

    const notesOff = mergeSyncPreferences({ syncNotes: false })
    expect(isSyncEntityEnabled('widget_note', notesOff)).toBe(false)

    const configOff = mergeSyncPreferences({ syncConfig: false })
    expect(isSyncEntityEnabled('app_settings', configOff)).toBe(false)
    expect(isSyncEntityEnabled('task_view', configOff)).toBe(false)
    expect(isSyncEntityEnabled('scheduled_summary', configOff)).toBe(false)
    expect(isSyncEntityEnabled('app_message', configOff)).toBe(true)

    const resultsOff = mergeSyncPreferences({ syncSummaryResults: false })
    expect(isSyncEntityEnabled('app_message', resultsOff)).toBe(false)
  })
})

describe('mergeSyncPreferences', () => {
  it('defaults interval to 30s and rejects invalid interval', () => {
    expect(mergeSyncPreferences().syncIntervalMs).toBe(30_000)
    expect(mergeSyncPreferences({ syncIntervalMs: 999 as never }).syncIntervalMs).toBe(30_000)
    expect(mergeSyncPreferences({ syncIntervalMs: 60_000 }).syncIntervalMs).toBe(60_000)
  })
})

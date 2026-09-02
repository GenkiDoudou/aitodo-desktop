import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  hideDoneScopeFromLegacy,
  resolveHideDoneScope,
  taskMatchesHideDoneScope
} from './hide-done-scope'
import type { Task } from './types'

function doneTask(completedAt: string): Task {
  return {
    id: '1',
    title: 't',
    description: null,
    status: 'DONE',
    priority: 4,
    categoryId: null,
    parentId: null,
    startAt: null,
    dueAt: null,
    remindAt: null,
    remindFiredAt: null,
    completedAt,
    sortOrder: 0,
    createdAt: '2026-01-01T10:00:00',
    updatedAt: completedAt,
    deletedAt: null,
    syncVersion: 1,
    kanbanGroupId: null,
    triagedAt: null
  }
}

describe('hide-done-scope', () => {
  it('migrates legacy hideDone boolean', () => {
    expect(hideDoneScopeFromLegacy(true)).toBe('all')
    expect(hideDoneScopeFromLegacy(false)).toBe('off')
    expect(resolveHideDoneScope({ hideDone: false })).toBe('off')
    expect(resolveHideDoneScope({ hideDoneScope: 'week' })).toBe('week')
  })

  it('hides only today completed when scope is today', () => {
    const base = dayjs('2026-09-02T12:00:00')
    const todayDone = doneTask('2026-09-02T15:00:00')
    const oldDone = doneTask('2026-08-01T15:00:00')

    expect(taskMatchesHideDoneScope(todayDone, 'today', base)).toBe(false)
    expect(taskMatchesHideDoneScope(oldDone, 'today', base)).toBe(true)
  })
})

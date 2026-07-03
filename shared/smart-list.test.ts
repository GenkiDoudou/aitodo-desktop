import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  dueCutoffIsoForSmartList,
  endOfWeekSunday,
  startOfWeekMonday,
  taskMatchesDueSmartList
} from './smart-list'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: 't',
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: null,
    parentId: null,
    dueAt: null,
    remindAt: null,
    remindFiredAt: null,
    completedAt: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    deletedAt: null,
    syncVersion: 0,
    kanbanGroupId: null,
    ...partial
  }
}

describe('smart-list', () => {
  const base = dayjs('2026-07-03T12:00:00')

  it('week range is Monday to Sunday', () => {
    expect(startOfWeekMonday(base).format('YYYY-MM-DD')).toBe('2026-06-29')
    expect(endOfWeekSunday(base).format('YYYY-MM-DD')).toBe('2026-07-05')
  })

  it('last7days cutoff is today + 6 days', () => {
    expect(dueCutoffIsoForSmartList('last7days', base)).toBe('2026-07-09T23:59:59')
  })

  it('matches overdue and in-range due tasks', () => {
    expect(
      taskMatchesDueSmartList(
        task({ id: '1', dueAt: '2026-06-01T10:00:00' }),
        'last7days',
        base
      )
    ).toBe(true)
    expect(
      taskMatchesDueSmartList(
        task({ id: '2', dueAt: '2026-07-10T10:00:00' }),
        'last7days',
        base
      )
    ).toBe(false)
    expect(taskMatchesDueSmartList(task({ id: '3', status: 'DONE', dueAt: '2026-07-01T10:00:00' }), 'today', base)).toBe(
      false
    )
  })
})

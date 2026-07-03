import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  calendarVisibleRange,
  formatCalendarTitle,
  groupTasksByDueDate,
  isTaskInRange
} from './calendar-tasks'
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

describe('calendar-tasks', () => {
  const anchor = dayjs('2026-09-06')

  it('formats month title', () => {
    expect(formatCalendarTitle(anchor, 'month')).toBe('9月')
  })

  it('groups tasks by due date', () => {
    const map = groupTasksByDueDate([
      task({ id: '1', dueAt: '2026-09-06T14:00:00' }),
      task({ id: '2', dueAt: '2026-09-06T08:00:00' }),
      task({ id: '3', dueAt: '2026-09-07T10:00:00' })
    ])
    expect(map.get('2026-09-06')?.map((t) => t.id)).toEqual(['2', '1'])
  })

  it('checks task in week range', () => {
    const { start, end } = calendarVisibleRange(anchor, 'week')
    expect(isTaskInRange(task({ id: '1', dueAt: '2026-09-06T10:00:00' }), start, end)).toBe(true)
    expect(isTaskInRange(task({ id: '2', dueAt: '2026-08-01T10:00:00' }), start, end)).toBe(false)
  })
})

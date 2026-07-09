import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  calendarVisibleRange,
  expandTaskCalendarInstances,
  expandTasksForCalendar,
  formatCalendarTitle,
  groupTasksByDueDate,
  isTaskInRange,
  recurrenceMatchesDate
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

  it('expands daily recurring task across week view', () => {
    const { start, end } = calendarVisibleRange(anchor, 'week')
    const daily = task({
      id: 'daily',
      dueAt: '2026-09-06T09:00:00',
      recurrence: { type: 'daily' }
    })
    const instances = expandTaskCalendarInstances(daily, start, end, 'dueAt')
    expect(instances.length).toBe(7)
  })

  it('expands weekly recurring task on matching weekday only', () => {
    const { start, end } = calendarVisibleRange(anchor, 'week')
    const weekly = task({
      id: 'weekly',
      dueAt: '2026-09-06T09:00:00',
      recurrence: { type: 'weekly' }
    })
    const instances = expandTaskCalendarInstances(weekly, start, end, 'dueAt')
    const weekday = dayjs('2026-09-06').day()
    expect(instances.every((t) => dayjs(t.dueAt!).day() === weekday)).toBe(true)
    expect(instances.length).toBe(1)
  })

  it('recurrenceMatchesDate handles workdays', () => {
    const anchor = dayjs('2026-09-08T09:00:00')
    expect(recurrenceMatchesDate(dayjs('2026-09-08'), anchor, { type: 'workdays' })).toBe(true)
    expect(recurrenceMatchesDate(dayjs('2026-09-06'), anchor, { type: 'workdays' })).toBe(false)
  })

  it('expandTasksForCalendar applies preset bounds', () => {
    const { start, end } = calendarVisibleRange(anchor, 'week')
    const daily = task({
      id: 'daily',
      dueAt: '2026-09-06T09:00:00',
      recurrence: { type: 'daily' }
    })
    const all = expandTasksForCalendar([daily], start, end, 'dueAt', null)
    expect(all.length).toBe(7)
  })

  it('marks only completed occurrence dates as DONE for recurring tasks', () => {
    const { start, end } = calendarVisibleRange(anchor, 'week')
    const daily = task({
      id: 'daily',
      dueAt: '2026-09-06T09:00:00',
      status: 'TODO',
      recurrence: { type: 'daily' },
      completedOccurrenceDates: ['2026-09-07']
    })
    const instances = expandTaskCalendarInstances(daily, start, end, 'dueAt')
    const byDate = new Map(instances.map((t) => [t.dueAt!.slice(0, 10), t.status]))
    expect(byDate.get('2026-09-06')).toBe('TODO')
    expect(byDate.get('2026-09-07')).toBe('DONE')
    expect(byDate.get('2026-09-08')).toBe('TODO')
  })
})

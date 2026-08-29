import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  calendarPresetBounds,
  doneTimeRangeBounds,
  smartListDateBounds,
  taskMatchesSmartListDate
} from './date-filter'
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

describe('date-filter', () => {
  const base = dayjs('2026-07-03T12:00:00')

  it('smartListDateBounds for createdAt today is closed day range', () => {
    const b = smartListDateBounds('today', 'createdAt', base)
    expect('from' in b && b.from).toBe('2026-07-03T00:00:00')
    expect('from' in b && b.to).toBe('2026-07-03T23:59:59')
  })

  it('matches createdAt in today range', () => {
    expect(
      taskMatchesSmartListDate(
        task({ id: '1', createdAt: '2026-07-03T08:00:00' }),
        'today',
        'createdAt',
        base
      )
    ).toBe(true)
    expect(
      taskMatchesSmartListDate(
        task({ id: '2', createdAt: '2026-07-02T08:00:00' }),
        'today',
        'createdAt',
        base
      )
    ).toBe(false)
  })

  it('matches completedAt for done tasks only', () => {
    expect(
      taskMatchesSmartListDate(
        task({
          id: '1',
          status: 'DONE',
          completedAt: '2026-07-03T10:00:00'
        }),
        'today',
        'completedAt',
        base
      )
    ).toBe(true)
    expect(
      taskMatchesSmartListDate(
        task({ id: '2', status: 'TODO', completedAt: null }),
        'today',
        'completedAt',
        base
      )
    ).toBe(false)
  })

  it('doneTimeRangeBounds month spans calendar month', () => {
    const b = doneTimeRangeBounds('month', base)
    expect(b?.from).toBe('2026-07-01T00:00:00')
    expect(b?.to).toBe('2026-07-31T23:59:59')
  })

  it('calendarPresetBounds day is single day', () => {
    const b = calendarPresetBounds('day', base)
    expect(b?.from).toBe('2026-07-03T00:00:00')
    expect(b?.to).toBe('2026-07-03T23:59:59')
  })
})

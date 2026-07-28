import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  dueAtForTimeColumn,
  groupByToKanbanBoardMode,
  tagColumnIdForTask,
  tagsForTagColumn,
  timeColumnIdForTask
} from './kanban-group-columns'
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

describe('groupByToKanbanBoardMode', () => {
  it('maps list groupBy to kanban board modes', () => {
    expect(groupByToKanbanBoardMode('status')).toBe('status')
    expect(groupByToKanbanBoardMode('priority')).toBe('priority')
    expect(groupByToKanbanBoardMode('time')).toBe('time')
    expect(groupByToKanbanBoardMode('tag')).toBe('tag')
    expect(groupByToKanbanBoardMode('none')).toBe('status')
  })
})

describe('time kanban columns', () => {
  const base = dayjs('2026-07-03T12:00:00') // Friday

  it('classifies tasks into time buckets', () => {
    expect(timeColumnIdForTask(task({ id: '1', dueAt: '2026-07-01T10:00:00' }), base)).toBe('overdue')
    expect(timeColumnIdForTask(task({ id: '2', dueAt: '2026-07-03T18:00:00' }), base)).toBe('today')
    expect(timeColumnIdForTask(task({ id: '3', dueAt: null }), base)).toBe('no-date')
  })

  it('writes dueAt when dropping into a time column', () => {
    expect(dueAtForTimeColumn('no-date', base)).toBeNull()
    expect(dueAtForTimeColumn('today', base)).toBe('2026-07-03T18:00:00')
    expect(dueAtForTimeColumn('tomorrow', base)).toBe('2026-07-04T18:00:00')
  })
})

describe('tag kanban columns', () => {
  it('uses primary tag or untagged', () => {
    expect(tagColumnIdForTask(task({ id: '1', tags: ['a', 'b'] }))).toBe('a')
    expect(tagColumnIdForTask(task({ id: '2', tags: [] }))).toBe('__none__')
  })

  it('moves primary tag on drop', () => {
    expect(tagsForTagColumn(task({ id: '1', tags: ['a', 'b'] }), 'c')).toEqual(['c', 'a', 'b'])
    expect(tagsForTagColumn(task({ id: '2', tags: ['a'] }), '__none__')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  UNCATEGORIZED_LIST_KEY,
  filterTasksBySelectedLists,
  taskMatchesSelectedLists
} from './visible-lists'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: null,
    parentId: null,
    startAt: null,
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
    triagedAt: null,
    ...partial
  }
}

describe('visible-lists', () => {
  const work = task({ id: 'p', title: '工作父', categoryId: 'work' })
  const child = task({ id: 'c', title: '子', parentId: 'p', categoryId: null })
  const uncategorized = task({ id: 'u', title: '未分类根', categoryId: null })
  const home = task({ id: 'h', title: '家', categoryId: 'home' })
  const byId = new Map(
    [work, child, uncategorized, home].map((t) => [t.id, t])
  )

  it('treats empty selection as all lists', () => {
    expect(taskMatchesSelectedLists(work, [], byId)).toBe(true)
    expect(taskMatchesSelectedLists(uncategorized, [], byId)).toBe(true)
    expect(filterTasksBySelectedLists([work, home], [], byId)).toEqual([work, home])
  })

  it('keeps a task when its category is selected', () => {
    expect(taskMatchesSelectedLists(work, ['work'], byId)).toBe(true)
    expect(taskMatchesSelectedLists(home, ['work'], byId)).toBe(false)
  })

  it('keeps uncategorized roots only when the sentinel is selected', () => {
    expect(taskMatchesSelectedLists(uncategorized, [UNCATEGORIZED_LIST_KEY], byId)).toBe(true)
    expect(taskMatchesSelectedLists(work, [UNCATEGORIZED_LIST_KEY], byId)).toBe(false)
  })

  it('keeps a child when its parent matches even if the child has no category', () => {
    expect(taskMatchesSelectedLists(child, ['work'], byId)).toBe(true)
    expect(taskMatchesSelectedLists(child, ['home'], byId)).toBe(false)
  })
})

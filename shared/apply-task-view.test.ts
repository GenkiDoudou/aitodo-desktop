import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { deriveAppliedViewState, filterTasksForViewWidget, flattenTasksForViewWidget, isFilterRuleActive } from './apply-task-view'
import type { FilterNode } from './task-filter-ast'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: partial.title ?? 't',
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

describe('apply-task-view', () => {
  it('deriveAppliedViewState maps kanban layout', () => {
    const state = deriveAppliedViewState({
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      kanbanBoardMode: 'status',
      filterRule: null
    })
    expect(state.viewLayout).toBe('kanban')
    expect(state.layout).toBe('kanban')
    expect(state.kanbanBoardMode).toBe('status')
  })

  it('deriveAppliedViewState maps quadrant layout', () => {
    const state = deriveAppliedViewState({
      layout: 'quadrant',
      groupBy: 'none',
      sortBy: 'time',
      filterRule: null,
      quadrantOptions: {
        showCompleted: true,
        enableGrouping: false,
        groupBy: 'none',
        sortBy: 'priority'
      }
    })
    expect(state.viewLayout).toBe('quadrant')
    expect(state.layout).toBe('list')
    expect(state.quadrantOptions?.showCompleted).toBe(true)
  })

  it('deriveAppliedViewState clears kanban mode for list', () => {
    const state = deriveAppliedViewState({
      layout: 'list',
      groupBy: 'time',
      sortBy: 'time',
      kanbanBoardMode: 'status',
      filterRule: null
    })
    expect(state.kanbanBoardMode).toBeNull()
  })

  it('isFilterRuleActive detects empty group', () => {
    const empty: FilterNode = { type: 'group', op: 'and', children: [] }
    expect(isFilterRuleActive(empty)).toBe(false)
    expect(isFilterRuleActive(null)).toBe(false)
  })

  it('filterTasksForViewWidget matches today due tasks for list views', () => {
    const today = dayjs('2026-07-11T12:00:00')
    const rule: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'dueAt', op: 'rel', value: 'today' }]
    }
    const tasks = [
      task({ id: 'a', dueAt: '2026-07-11T10:00:00' }),
      task({ id: 'b', dueAt: '2026-07-12T10:00:00' })
    ]
    const result = filterTasksForViewWidget(
      tasks,
      { layout: 'list', filterRule: rule, kanbanBoardMode: null, quadrantOptions: null },
      { now: today }
    )
    expect(result.map((item) => item.id)).toEqual(['a'])
  })

  it('filterTasksForViewWidget includes subtasks for kanban roots', () => {
    const rule: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'status', op: 'in', value: ['TODO', 'IN_PROGRESS'] }]
    }
    const tasks = [
      task({ id: 'root', status: 'TODO' }),
      task({ id: 'child', parentId: 'root', status: 'TODO', categoryId: null })
    ]
    const result = filterTasksForViewWidget(
      tasks,
      { layout: 'kanban', filterRule: rule, kanbanBoardMode: 'status', quadrantOptions: null },
      { hideDone: true }
    )
    expect(result.map((item) => item.id).sort()).toEqual(['child', 'root'])
  })

  it('flattenTasksForViewWidget nests subtasks under parents', () => {
    const tasks = [
      task({ id: 'root', title: '父' }),
      task({ id: 'child', parentId: 'root', title: '子' })
    ]
    const rows = flattenTasksForViewWidget(tasks)
    expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
      ['root', 0],
      ['child', 1]
    ])
  })
})

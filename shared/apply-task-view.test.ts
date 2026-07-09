import { describe, expect, it } from 'vitest'
import { deriveAppliedViewState, isFilterRuleActive } from './apply-task-view'
import type { FilterNode } from './task-filter-ast'

describe('apply-task-view', () => {
  it('deriveAppliedViewState maps kanban layout', () => {
    const state = deriveAppliedViewState({
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      kanbanBoardMode: 'status',
      filterRule: null
    })
    expect(state.layout).toBe('kanban')
    expect(state.kanbanBoardMode).toBe('status')
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
})

import type { FilterNode } from './task-filter-ast'
import type { CreateTaskViewDto } from './types'
import type { KanbanBoardMode } from './kanban-config'

export type ViewTemplateId =
  | 'team-planning'
  | 'kanban'
  | 'feature-release'
  | 'bug-tracker'
  | 'iterative-development'
  | 'product-launch'
  | 'roadmap'
  | 'team-retrospective'

export interface ViewTemplateDefinition {
  id: ViewTemplateId
  title: string
  description: string
  preset: CreateTaskViewDto
}

const EXCLUDE_DONE: FilterNode = {
  type: 'group',
  op: 'and',
  children: [{ type: 'cond', field: 'status', op: 'in', value: ['TODO', 'IN_PROGRESS'] }]
}

const TITLE_CONTAINS_BUG: FilterNode = {
  type: 'group',
  op: 'and',
  children: [{ type: 'cond', field: 'title', op: 'contains', value: 'bug' }]
}

const HAS_DUE: FilterNode = {
  type: 'group',
  op: 'and',
  children: [{ type: 'cond', field: 'dueAt', op: 'isNotEmpty' }]
}

export const VIEW_TEMPLATES: ViewTemplateDefinition[] = [
  {
    id: 'team-planning',
    title: 'Team planning',
    description: '列表按时间分组，隐藏已完成',
    preset: {
      name: 'Team planning',
      layout: 'list',
      groupBy: 'time',
      sortBy: 'time',
      filterRule: EXCLUDE_DONE
    }
  },
  {
    id: 'kanban',
    title: 'Kanban',
    description: '状态看板，隐藏已完成',
    preset: {
      name: 'Kanban',
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      filterRule: EXCLUDE_DONE,
      kanbanBoardMode: 'status' as KanbanBoardMode
    }
  },
  {
    id: 'feature-release',
    title: 'Feature release',
    description: '按优先级分组排序',
    preset: {
      name: 'Feature release',
      layout: 'list',
      groupBy: 'priority',
      sortBy: 'priority',
      filterRule: null
    }
  },
  {
    id: 'bug-tracker',
    title: 'Bug tracker',
    description: '分组看板，标题含 bug',
    preset: {
      name: 'Bug tracker',
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      filterRule: TITLE_CONTAINS_BUG,
      kanbanBoardMode: 'group'
    }
  },
  {
    id: 'iterative-development',
    title: 'Iterative development',
    description: '分组看板，适合迭代',
    preset: {
      name: 'Iterative development',
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      filterRule: null,
      kanbanBoardMode: 'group'
    }
  },
  {
    id: 'product-launch',
    title: 'Product launch',
    description: '列表按时间排序',
    preset: {
      name: 'Product launch',
      layout: 'list',
      groupBy: 'none',
      sortBy: 'time',
      filterRule: null
    }
  },
  {
    id: 'roadmap',
    title: 'Roadmap',
    description: '时间线，仅有截止日的任务',
    preset: {
      name: 'Roadmap',
      layout: 'timeline',
      groupBy: 'none',
      sortBy: 'time',
      filterRule: HAS_DUE
    }
  },
  {
    id: 'team-retrospective',
    title: 'Team retrospective',
    description: '分组看板，回顾会议',
    preset: {
      name: 'Team retrospective',
      layout: 'kanban',
      groupBy: 'none',
      sortBy: 'custom',
      filterRule: null,
      kanbanBoardMode: 'group'
    }
  }
]

export function getViewTemplate(id: ViewTemplateId): ViewTemplateDefinition | undefined {
  return VIEW_TEMPLATES.find((t) => t.id === id)
}

import type { FilterNode } from './task-filter-ast'
import type { CreateTaskViewDto } from './types'

/** 设计稿侧栏「我的清单」预设色（DESIGN.md §4.1） */
export const DESIGN_LIST_CATEGORIES = [
  { name: '工作', color: '#0066ff' },
  { name: '项目', color: '#fa8c16' },
  { name: '学习', color: '#52c41a' },
  { name: '生活', color: '#722ed1' }
] as const

const ACTIVE_ONLY: FilterNode = {
  type: 'group',
  op: 'and',
  children: [{ type: 'cond', field: 'status', op: 'in', value: ['TODO', 'IN_PROGRESS'] }]
}

/** 设计稿「我的视图」四项（8a3c6830 侧栏） */
export const DESIGN_SIDEBAR_VIEWS: CreateTaskViewDto[] = [
  {
    name: '本周重点',
    layout: 'list',
    groupBy: 'time',
    sortBy: 'time',
    filterRule: {
      type: 'group',
      op: 'and',
      children: [
        ...ACTIVE_ONLY.children!,
        { type: 'cond', field: 'priority', op: 'in', value: [1, 2] }
      ]
    }
  },
  {
    name: '高优先级',
    layout: 'list',
    groupBy: 'priority',
    sortBy: 'priority',
    filterRule: {
      type: 'group',
      op: 'and',
      children: [
        ...ACTIVE_ONLY.children!,
        { type: 'cond', field: 'priority', op: 'in', value: [1, 2] }
      ]
    }
  },
  {
    name: '未安排',
    layout: 'list',
    groupBy: 'none',
    sortBy: 'createdAt',
    filterRule: {
      type: 'group',
      op: 'and',
      children: [
        ...ACTIVE_ONLY.children!,
        { type: 'cond', field: 'dueAt', op: 'isEmpty' }
      ]
    }
  },
  {
    name: '等待中',
    layout: 'list',
    groupBy: 'status',
    sortBy: 'time',
    filterRule: {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'status', op: 'eq', value: 'IN_PROGRESS' }]
    }
  }
]

import type { KanbanBoardMode } from './kanban-config'
import type { FilterField } from './task-filter-ast'

/** 视图编辑器中可选的筛选字段 */
export const VIEW_EDITOR_FILTER_FIELDS: FilterField[] = [
  'priority',
  'category',
  'status',
  'dueAt',
  'completedAt',
  'createdAt'
]

export const VIEW_EDITOR_FILTER_FIELD_LABELS: Record<
  (typeof VIEW_EDITOR_FILTER_FIELDS)[number],
  string
> = {
  priority: '任务级别',
  category: '任务分类',
  status: '状态',
  dueAt: '截止时间',
  completedAt: '完成时间',
  createdAt: '创建时间'
}

/** 看板布局下的分组方式（对应 kanbanBoardMode） */
export const VIEW_EDITOR_KANBAN_GROUP_OPTIONS: { value: KanbanBoardMode; label: string }[] = [
  { value: 'group', label: '任务分组' },
  { value: 'priority', label: '任务级别' },
  { value: 'status', label: '任务状态' },
  { value: 'time', label: '时间' },
  { value: 'tag', label: '标签' }
]

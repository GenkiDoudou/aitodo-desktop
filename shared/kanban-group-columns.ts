import dayjs, { type Dayjs } from 'dayjs'
import type { Task } from './types'
import type { TaskGroupBy } from './task-list-layout'
import { timeGroupKey } from './task-list-layout'
import { endOfWeekSunday } from './smart-list'
import { extractTaskTags, primaryTaskTag } from './task-tags'
import type { KanbanBoardMode } from './kanban-config'

/** 列表分组 → 看板列模式（看板不含「不分组」） */
export function groupByToKanbanBoardMode(groupBy: TaskGroupBy): Exclude<KanbanBoardMode, 'group'> {
  if (groupBy === 'priority') return 'priority'
  if (groupBy === 'time') return 'time'
  if (groupBy === 'tag') return 'tag'
  return 'status'
}

export const KANBAN_TIME_COLUMN_IDS = [
  'overdue',
  'today',
  'tomorrow',
  'this-week',
  'later',
  'no-date'
] as const

export type KanbanTimeColumnId = (typeof KANBAN_TIME_COLUMN_IDS)[number]

export const KANBAN_TIME_COLUMNS: { id: KanbanTimeColumnId; label: string }[] = [
  { id: 'overdue', label: '已过期' },
  { id: 'today', label: '今天' },
  { id: 'tomorrow', label: '明天' },
  { id: 'this-week', label: '本周' },
  { id: 'later', label: '以后' },
  { id: 'no-date', label: '无日期' }
]

export const KANBAN_UNTAGGED_ID = '__none__'

export function isKanbanTimeColumnId(id: string): id is KanbanTimeColumnId {
  return (KANBAN_TIME_COLUMN_IDS as readonly string[]).includes(id)
}

/** 任务落入哪个时间列（与列表 timeGroupKey 一致） */
export function timeColumnIdForTask(task: Task, base: Dayjs = dayjs()): string {
  return timeGroupKey(task, base).key
}

/** 拖入时间列时写入的截止时间；无日期返回 null */
export function dueAtForTimeColumn(columnId: string, base: Dayjs = dayjs()): string | null {
  const day = base.startOf('day')
  const atDusk = (d: Dayjs) => d.hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss')
  switch (columnId) {
    case 'no-date':
      return null
    case 'overdue':
      return atDusk(day.subtract(1, 'day'))
    case 'today':
      return atDusk(day)
    case 'tomorrow':
      return atDusk(day.add(1, 'day'))
    case 'this-week':
      return atDusk(endOfWeekSunday(base))
    case 'later':
      return atDusk(day.add(8, 'day'))
    default:
      return atDusk(day)
  }
}

/** 当前任务集上的标签列 + 无标签 */
export function tagColumnsForTasks(tasks: Task[]): { id: string; name: string }[] {
  const tags = new Set<string>()
  for (const task of tasks) {
    const tag = primaryTaskTag(task)
    if (tag) tags.add(tag)
  }
  const cols = [...tags]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((tag) => ({ id: tag, name: `#${tag}` }))
  cols.push({ id: KANBAN_UNTAGGED_ID, name: '无标签' })
  return cols
}

export function tagColumnIdForTask(task: Task): string {
  return primaryTaskTag(task) || KANBAN_UNTAGGED_ID
}

/** 拖入标签列后的 tags 字段 */
export function tagsForTagColumn(task: Task, columnId: string): string[] {
  if (columnId === KANBAN_UNTAGGED_ID) return []
  const rest = extractTaskTags(task).filter((t) => t !== columnId)
  return [columnId, ...rest]
}

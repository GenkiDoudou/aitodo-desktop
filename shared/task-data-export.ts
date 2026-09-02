import type { Category, KanbanGroup, Task, TaskStatus } from './types'
import type { TaskReminderInput, TaskRecurrenceRule } from './task-reminder'
import type { TaskPriority } from './task-priority'

/** 任务数据导出 JSON 格式版本 */
export const TASK_DATA_EXPORT_VERSION = 1 as const
export const TASK_DATA_EXPORT_KIND = 'aitodo-tasks' as const

/** 单条任务导出结构（不含 sync/删除态等运行时字段） */
export interface TaskExportItem {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  categoryId: string | null
  /** 便于跨设备导入时按名称匹配清单 */
  categoryName?: string | null
  parentId: string | null
  startAt: string | null
  dueAt: string | null
  remindAt: string | null
  completedAt: string | null
  sortOrder: number
  kanbanGroupId: string | null
  tags: string[]
  reminders?: TaskReminderInput[]
  recurrence?: TaskRecurrenceRule | null
  completedOccurrenceDates?: string[]
  remindContinuous?: boolean
  triagedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryExportItem {
  id: string
  name: string
  color: string | null
  sortOrder: number
  keywords: string[]
}

export interface KanbanGroupExportItem {
  id: string
  scopeKey: string
  name: string
  sortOrder: number
}

export interface TaskDataExport {
  kind: typeof TASK_DATA_EXPORT_KIND
  version: typeof TASK_DATA_EXPORT_VERSION
  exportedAt: string
  categories: CategoryExportItem[]
  kanbanGroups: KanbanGroupExportItem[]
  tasks: TaskExportItem[]
}

export interface TaskDataImportResult {
  importedTasks: number
  updatedTasks: number
  importedCategories: number
  skippedTrash: number
}

function categoryNameById(categories: Category[], id: string | null): string | null {
  if (!id) return null
  return categories.find((c) => c.id === id)?.name ?? null
}

/** 从内存中的实体构建可序列化导出包 */
export function buildTaskDataExport(payload: {
  tasks: Task[]
  categories: Category[]
  kanbanGroups?: KanbanGroup[]
}): TaskDataExport {
  const categories = payload.categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    keywords: c.keywords ?? []
  }))

  const kanbanGroups = (payload.kanbanGroups ?? []).map((g) => ({
    id: g.id,
    scopeKey: g.scopeKey,
    name: g.name,
    sortOrder: g.sortOrder
  }))

  const tasks = payload.tasks
    .filter((t) => !t.deletedAt)
    .map((t) => taskToExportItem(t, payload.categories))

  return {
    kind: TASK_DATA_EXPORT_KIND,
    version: TASK_DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    kanbanGroups,
    tasks
  }
}

export function taskToExportItem(task: Task, categories: Category[]): TaskExportItem {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    categoryId: task.categoryId,
    categoryName: categoryNameById(categories, task.categoryId),
    parentId: task.parentId,
    startAt: task.startAt,
    dueAt: task.dueAt,
    remindAt: task.remindAt,
    completedAt: task.completedAt,
    sortOrder: task.sortOrder,
    kanbanGroupId: task.kanbanGroupId,
    tags: task.tags ?? [],
    reminders: task.reminders?.map((r) => ({
      remindAt: r.remindAt,
      offsetMinutes: r.offsetMinutes ?? null
    })),
    recurrence: task.recurrence ?? null,
    completedOccurrenceDates: task.completedOccurrenceDates ?? [],
    remindContinuous: task.remindContinuous ?? false,
    triagedAt: task.triagedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  DONE: '已完成'
}

function formatLine(text: string | null | undefined): string {
  return text?.trim() ? text.trim() : ''
}

/** 将任务列表渲染为 Markdown 文档（便于阅读与分享） */
export function tasksToMarkdown(
  tasks: TaskExportItem[],
  categories: CategoryExportItem[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]))
  const byCategory = new Map<string, TaskExportItem[]>()

  for (const task of tasks) {
    const key = task.categoryId ?? '__none__'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(task)
  }

  const lines: string[] = ['# 小柒 Todo 任务导出', '']
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push(`> 任务数：${tasks.length}`)
  lines.push('')

  const keys = [...byCategory.keys()].sort((a, b) => {
    const na = a === '__none__' ? 'zzz' : catMap.get(a) ?? a
    const nb = b === '__none__' ? 'zzz' : catMap.get(b) ?? b
    return na.localeCompare(nb, 'zh-CN')
  })

  for (const key of keys) {
    const heading = key === '__none__' ? '未分类' : catMap.get(key) ?? key
    lines.push(`## ${heading}`, '')
    for (const task of byCategory.get(key) ?? []) {
      const checked = task.status === 'DONE' ? 'x' : ' '
      lines.push(`- [${checked}] **${task.title}**（${STATUS_LABEL[task.status]}）`)
      if (task.dueAt) lines.push(`  - 截止：${task.dueAt}`)
      if (task.completedAt) lines.push(`  - 完成：${task.completedAt}`)
      if (task.tags?.length) lines.push(`  - 标签：${task.tags.join('、')}`)
      const desc = formatLine(task.description)
      if (desc) {
        lines.push('  - 描述：')
        for (const row of desc.split('\n')) {
          lines.push(`    ${row}`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

export function parseTaskDataExport(raw: string): TaskDataExport {
  const parsed = JSON.parse(raw) as TaskDataExport
  if (parsed.kind !== TASK_DATA_EXPORT_KIND) {
    throw new Error('不是有效的任务导出文件')
  }
  if (parsed.version !== TASK_DATA_EXPORT_VERSION) {
    throw new Error('不支持的任务导出版本')
  }
  if (!Array.isArray(parsed.tasks)) {
    throw new Error('任务导出格式无效')
  }
  return parsed
}

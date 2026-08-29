import dayjs from 'dayjs'
import type { Task } from './types'

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export interface CompletedTaskGroup {
  /** 完成日期 YYYY-MM-DD，用于折叠状态 key */
  key: string
  /** 侧栏分组标题，如「今天 周五」「4月12日 周日」 */
  label: string
  tasks: Task[]
}

/** 取任务完成时间：优先 completedAt，无则回退 updatedAt */
export function resolveTaskCompletedAt(task: Task): string | null {
  if (task.status !== 'DONE') return null
  return task.completedAt ?? task.updatedAt ?? null
}

/** 已完成列表分组标题（中文星期） */
export function formatCompletedGroupLabel(dateKey: string): string {
  const d = dayjs(dateKey)
  if (!d.isValid()) return dateKey
  const weekday = WEEKDAY_LABELS[d.day()]
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  if (dateKey === today) return `今天 ${weekday}`
  if (dateKey === yesterday) return `昨天 ${weekday}`
  if (d.year() === dayjs().year()) return `${d.format('M月D日')} ${weekday}`
  return `${d.format('YYYY年M月D日')} ${weekday}`
}

/**
 * 将已完成任务按完成日期倒序分组（新日期在上）。
 * @param categoryId undefined=不过滤；null=仅未分类；string=指定清单
 */
export function groupCompletedTasksByDate(
  tasks: Task[],
  categoryId?: string | null
): CompletedTaskGroup[] {
  let list = tasks.filter((t) => t.status === 'DONE')
  if (categoryId !== undefined) {
    list = list.filter((t) => t.categoryId === categoryId)
  }

  const byDate = new Map<string, Task[]>()
  for (const task of list) {
    const iso = resolveTaskCompletedAt(task)
    if (!iso) continue
    const key = iso.slice(0, 10)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(task)
  }

  const sortByCompleted = (a: Task, b: Task) => {
    const ta = resolveTaskCompletedAt(a) ?? ''
    const tb = resolveTaskCompletedAt(b) ?? ''
    return tb.localeCompare(ta)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupTasks]) => ({
      key,
      label: formatCompletedGroupLabel(key),
      tasks: [...groupTasks].sort(sortByCompleted)
    }))
}

/** 已完成列表展示：子任务附带主任务标题 */
export function completedTaskDisplayTitle(task: Task, taskById: Map<string, Task>): string {
  if (!task.parentId) return task.title
  const parent = taskById.get(task.parentId)
  if (!parent) return task.title
  return `${parent.title} / ${task.title}`
}

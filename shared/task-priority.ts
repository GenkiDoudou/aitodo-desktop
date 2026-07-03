/** 艾森豪威尔四象限优先级：1=重要紧急 … 4=不重要不紧急 */
export type TaskPriority = 1 | 2 | 3 | 4

export const DEFAULT_TASK_PRIORITY: TaskPriority = 4

export interface TaskPriorityMeta {
  value: TaskPriority
  label: string
  /** 象限卡片标题 */
  quadrantTitle: string
  color: string
  roman: string
}

export const TASK_PRIORITIES: TaskPriorityMeta[] = [
  {
    value: 1,
    label: '重要且紧急',
    quadrantTitle: '重要且紧急',
    color: '#f56c6c',
    roman: 'Ⅰ'
  },
  {
    value: 2,
    label: '重要不紧急',
    quadrantTitle: '重要不紧急',
    color: '#e6a23c',
    roman: 'Ⅱ'
  },
  {
    value: 3,
    label: '不重要但紧急',
    quadrantTitle: '不重要但紧急',
    color: '#409eff',
    roman: 'Ⅲ'
  },
  {
    value: 4,
    label: '不重要不紧急',
    quadrantTitle: '不重要不紧急',
    color: '#67c23a',
    roman: 'Ⅳ'
  }
]

export function isValidTaskPriority(value: number): value is TaskPriority {
  return value >= 1 && value <= 4 && Number.isInteger(value)
}

/** IPC/表单可能传入字符串数字，统一转为 1–4 */
export function coerceTaskPriority(
  value: unknown,
  fallback: TaskPriority = DEFAULT_TASK_PRIORITY
): TaskPriority {
  if (value == null || value === '') {
    return fallback
  }
  const n = typeof value === 'number' ? value : Number(value)
  return isValidTaskPriority(n) ? n : fallback
}

export function normalizeTaskPriority(value: number | null | undefined): TaskPriority {
  return coerceTaskPriority(value, DEFAULT_TASK_PRIORITY)
}

export function getTaskPriorityMeta(priority: TaskPriority): TaskPriorityMeta {
  return TASK_PRIORITIES.find((p) => p.value === priority) ?? TASK_PRIORITIES[3]
}

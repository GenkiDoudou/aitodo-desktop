/** 艾森豪威尔四象限优先级：1=重要紧急 … 4=不重要不紧急 */
export type TaskPriority = 1 | 2 | 3 | 4

export const DEFAULT_TASK_PRIORITY: TaskPriority = 4

export interface TaskPriorityMeta {
  value: TaskPriority
  /** 对外级别代号：P0–P3，对应四象限 1–4 */
  code: `P${0 | 1 | 2 | 3}`
  label: string
  /** 详情页旗帜菜单文案 */
  flagLabel: string
  /** 象限卡片标题 */
  quadrantTitle: string
  color: string
  /** 详情页旗帜颜色（可与象限色区分） */
  flagColor: string
  /** 旗帜是否为空心（无优先级） */
  flagOutline: boolean
  roman: string
}

export const TASK_PRIORITIES: TaskPriorityMeta[] = [
  {
    value: 1,
    code: 'P0',
    label: '重要且紧急',
    flagLabel: 'P0',
    quadrantTitle: '重要且紧急',
    color: '#f56c6c',
    flagColor: '#f56c6c',
    flagOutline: false,
    roman: 'Ⅰ'
  },
  {
    value: 2,
    code: 'P1',
    label: '重要不紧急',
    flagLabel: 'P1',
    quadrantTitle: '重要不紧急',
    color: '#e6a23c',
    flagColor: '#e6a23c',
    flagOutline: false,
    roman: 'Ⅱ'
  },
  {
    value: 3,
    code: 'P2',
    label: '不重要但紧急',
    flagLabel: 'P2',
    quadrantTitle: '不重要但紧急',
    color: '#409eff',
    flagColor: '#409eff',
    flagOutline: false,
    roman: 'Ⅲ'
  },
  {
    value: 4,
    code: 'P3',
    label: '不重要不紧急',
    flagLabel: 'P3',
    quadrantTitle: '不重要不紧急',
    color: '#909399',
    flagColor: '#909399',
    flagOutline: true,
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

import dayjs from 'dayjs'
import type { IsoDateTime } from './types'

/** 单条任务提醒（相对截止或绝对时间） */
export interface TaskReminderItem {
  id: string
  taskId: string
  remindAt: IsoDateTime
  firedAt: IsoDateTime | null
  /** 相对 dueAt 提前的分钟数；绝对提醒为 null */
  offsetMinutes: number | null
}

/** 创建/更新时提交的提醒项（无 id） */
export interface TaskReminderInput {
  remindAt: IsoDateTime
  offsetMinutes?: number | null
}

export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'workdays'
  | 'weekend'
  | 'legal_holidays'
  | 'custom'

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

/** 自定义循环单位（与提醒自定义偏移区分：此处无分钟/小时） */
export const RECURRENCE_CUSTOM_UNITS: { key: RecurrenceUnit; label: string }[] = [
  { key: 'day', label: '天' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' }
]

/** 循环规则（存 tasks.recurrence_rule JSON） */
export interface TaskRecurrenceRule {
  type: RecurrenceType
  /** 自定义间隔，type=custom 时使用 */
  interval?: number
  unit?: RecurrenceUnit
}

export interface RemindOffsetPreset {
  key: string
  label: string
  minutes: number
}

/** 相对截止的预设偏移（与滴答清单一致） */
export const REMIND_OFFSET_PRESETS: RemindOffsetPreset[] = [
  { key: 'on-time', label: '准时', minutes: 0 },
  { key: 'm5', label: '提前5分钟', minutes: 5 },
  { key: 'm30', label: '提前30分钟', minutes: 30 },
  { key: 'h1', label: '提前1小时', minutes: 60 },
  { key: 'd1', label: '提前1天', minutes: 24 * 60 }
]

export type RemindCustomUnit = 'minute' | 'hour' | 'day' | 'week'

export const REMIND_CUSTOM_UNITS: { key: RemindCustomUnit; label: string }[] = [
  { key: 'minute', label: '分钟' },
  { key: 'hour', label: '小时' },
  { key: 'day', label: '天' },
  { key: 'week', label: '周' }
]

export function remindAtFromDueOffset(dueAt: string, offsetMinutes: number): string {
  return dayjs(dueAt).subtract(offsetMinutes, 'minute').format('YYYY-MM-DDTHH:mm:ss')
}

export function customOffsetToMinutes(amount: number, unit: RemindCustomUnit): number {
  switch (unit) {
    case 'minute':
      return amount
    case 'hour':
      return amount * 60
    case 'day':
      return amount * 24 * 60
    case 'week':
      return amount * 7 * 24 * 60
  }
}

/** 校验所有提醒不得晚于截止 */
export function assertRemindersBeforeDue(
  reminders: TaskReminderInput[],
  dueAt: string | null
): string | null {
  if (!dueAt) return null
  for (const r of reminders) {
    if (r.remindAt > dueAt) {
      return '提醒时间不能晚于到期时间'
    }
  }
  return null
}

/** 从 dueAt + 选中的偏移分钟集合生成提醒输入 */
export function buildRemindersFromOffsets(
  dueAt: string,
  offsetMinutesList: number[]
): TaskReminderInput[] {
  const unique = [...new Set(offsetMinutesList)].sort((a, b) => b - a)
  return unique.map((minutes) => ({
    remindAt: remindAtFromDueOffset(dueAt, minutes),
    offsetMinutes: minutes
  }))
}

/** 列表展示用：取最早未触发提醒同步到 legacy remindAt */
export function primaryRemindAt(reminders: Array<{ remindAt: IsoDateTime }>): IsoDateTime | null {
  if (!reminders.length) return null
  const sorted = [...reminders].sort((a, b) => a.remindAt.localeCompare(b.remindAt))
  return sorted[0]?.remindAt ?? null
}

export function parseRecurrenceRule(json: string | null | undefined): TaskRecurrenceRule | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as TaskRecurrenceRule & { type?: string }
    const type = parsed?.type
    if (!type || type === 'none') return null
    // 已移除艾宾浩斯：旧数据降级为不重复
    if (type === 'ebbinghaus') return null
    return parsed
  } catch {
    return null
  }
}

export function serializeRecurrenceRule(rule: TaskRecurrenceRule | null | undefined): string | null {
  if (!rule || rule.type === 'none') return null
  return JSON.stringify(rule)
}

/** 循环触发后计算下一次 dueAt（基础类型） */
export function nextDueAfterRecurrence(dueAt: string, rule: TaskRecurrenceRule): string | null {
  const d = dayjs(dueAt)
  if (!d.isValid()) return null

  switch (rule.type) {
    case 'daily':
      return d.add(1, 'day').format('YYYY-MM-DDTHH:mm:ss')
    case 'weekly':
      return d.add(1, 'week').format('YYYY-MM-DDTHH:mm:ss')
    case 'monthly':
      return d.add(1, 'month').format('YYYY-MM-DDTHH:mm:ss')
    case 'yearly':
      return d.add(1, 'year').format('YYYY-MM-DDTHH:mm:ss')
    case 'workdays': {
      let next = d.add(1, 'day')
      while (next.day() === 0 || next.day() === 6) {
        next = next.add(1, 'day')
      }
      return next.format('YYYY-MM-DDTHH:mm:ss')
    }
    case 'weekend': {
      let next = d.add(1, 'day')
      while (next.day() !== 0 && next.day() !== 6) {
        next = next.add(1, 'day')
      }
      return next.format('YYYY-MM-DDTHH:mm:ss')
    }
    case 'custom': {
      const n = rule.interval ?? 1
      const unit = rule.unit ?? 'day'
      return d.add(n, unit).format('YYYY-MM-DDTHH:mm:ss')
    }
    case 'legal_holidays':
      // 法定节假日由主进程 HolidayService + timor.tech API 异步计算
      return null
    default:
      return null
  }
}

export function recurrenceLabel(rule: TaskRecurrenceRule | null, dueAt?: string | null): string {
  if (!rule || rule.type === 'none') return '重复'
  const d = dueAt ? dayjs(dueAt) : dayjs()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  switch (rule.type) {
    case 'daily':
      return '每天'
    case 'weekly':
      return `每周（周${weekdays[d.day()]}）`
    case 'monthly':
      return `每月（${d.date()}日）`
    case 'yearly':
      return `每年（${d.month() + 1}月${d.date()}日）`
    case 'workdays':
      return '工作日'
    case 'weekend':
      return '每周末'
    case 'legal_holidays':
      return '法定节假日'
    case 'custom':
      return `每${rule.interval ?? 1}${unitLabel(rule.unit ?? 'day')}`
    default:
      return '重复'
  }
}

function unitLabel(unit: RecurrenceUnit): string {
  const map: Record<RecurrenceUnit, string> = {
    day: '天',
    week: '周',
    month: '月',
    year: '年'
  }
  return map[unit]
}

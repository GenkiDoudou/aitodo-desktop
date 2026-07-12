import dayjs from 'dayjs'
import { endOfWeekSunday, startOfWeekMonday } from '@shared/smart-list'

/** 生成 00:00–23:30 每 30 分钟一档，避免滚轮时间选择误触 */
export function buildTimeSlots(stepMinutes = 30): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

/** 将 HH:mm 或 HH:mm:ss 规范为 HH:mm */
export function normalizeHm(value: string): string {
  const parts = value.split(':')
  return `${parts[0]?.padStart(2, '0') ?? '00'}:${parts[1]?.padStart(2, '0') ?? '00'}`
}

/** 日历网格：从周一对齐的 5–6 周日期 */
export function buildCalendarDays(month: dayjs.Dayjs): dayjs.Dayjs[] {
  const start = startOfWeekMonday(month.startOf('month'))
  const end = endOfWeekSunday(month.endOf('month'))
  const days: dayjs.Dayjs[] = []
  let cursor = start
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    days.push(cursor)
    cursor = cursor.add(1, 'day')
  }
  return days
}

export interface QuickDatePreset {
  key: string
  label: string
  icon: 'today' | 'tomorrow' | 'next-week' | 'tonight'
  apply: () => { date: dayjs.Dayjs; time: string }
}

export function defaultQuickPresets(): QuickDatePreset[] {
  return [
    {
      key: 'today',
      label: '今天',
      icon: 'today',
      apply: () => ({ date: dayjs(), time: dayjs().format('HH:mm') })
    },
    {
      key: 'tomorrow',
      label: '明天',
      icon: 'tomorrow',
      apply: () => ({ date: dayjs().add(1, 'day'), time: '09:00' })
    },
    {
      key: 'next-week',
      label: '下周',
      icon: 'next-week',
      apply: () => ({ date: dayjs().add(7, 'day'), time: '09:00' })
    },
    {
      key: 'tonight',
      label: '今晚',
      icon: 'tonight',
      apply: () => ({ date: dayjs(), time: '20:00' })
    }
  ]
}

export interface RemindOffsetOption {
  key: string
  label: string
  minutes: number | null
}

/** 相对截止的提醒偏移；minutes=0 表示准时 */
export function remindOffsetOptions(): RemindOffsetOption[] {
  return [
    { key: 'on-time', label: '准时', minutes: 0 },
    { key: 'm5', label: '提前 5 分钟', minutes: 5 },
    { key: 'm30', label: '提前 30 分钟', minutes: 30 },
    { key: 'h1', label: '提前 1 小时', minutes: 60 },
    { key: 'd1', label: '提前 1 天', minutes: 24 * 60 }
  ]
}

export function remindFromDue(dueAt: string, offsetMinutes: number): string {
  return dayjs(dueAt).subtract(offsetMinutes, 'minute').format('YYYY-MM-DDTHH:mm:ss')
}

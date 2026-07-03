import dayjs from 'dayjs'
import type { SmartList, Task } from './types'

/** 带截止日的智能列表（今天 / 本周 / 最近7天） */
export type DueSmartList = Extract<SmartList, 'today' | 'week' | 'last7days'>

export const DUE_SMART_LISTS: DueSmartList[] = ['today', 'week', 'last7days']

export function isDueSmartList(smart?: SmartList): smart is DueSmartList {
  return smart === 'today' || smart === 'week' || smart === 'last7days'
}

/** 周一为一周开始（与国内习惯一致） */
export function startOfWeekMonday(base = dayjs()) {
  const day = base.day()
  const offset = day === 0 ? -6 : 1 - day
  return base.add(offset, 'day').startOf('day')
}

/** 本周周日 23:59:59 */
export function endOfWeekSunday(base = dayjs()) {
  return startOfWeekMonday(base).add(6, 'day').endOf('day')
}

/** 截止比较用 ISO 本地日末：yyyy-MM-ddT23:59:59 */
export function endOfDayIso(d: dayjs.Dayjs): string {
  return `${d.format('YYYY-MM-DD')}T23:59:59`
}

/**
 * 智能列表截止上界（含当天/当周/7日内）：
 * - today：今天末
 * - week：本周周日末（含已过期）
 * - last7days：今天起连续 7 天末（含已过期）
 */
export function dueCutoffIsoForSmartList(smart: DueSmartList, base = dayjs()): string {
  switch (smart) {
    case 'today':
      return endOfDayIso(base)
    case 'week':
      return endOfDayIso(endOfWeekSunday(base))
    case 'last7days':
      return endOfDayIso(base.add(6, 'day'))
  }
}

/** 任务是否属于带截止日的智能列表（与 task-repository SQL 一致） */
export function taskMatchesDueSmartList(task: Task, smart: DueSmartList, base = dayjs()): boolean {
  if (task.status === 'DONE') return false
  if (!task.dueAt) return false
  return task.dueAt <= dueCutoffIsoForSmartList(smart, base)
}

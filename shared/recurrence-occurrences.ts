/** 循环任务「某天已完成」的日期键 YYYY-MM-DD */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 规范化并去重排序 */
export function normalizeCompletedOccurrenceDates(dates: string[] | null | undefined): string[] {
  if (!dates?.length) return []
  const set = new Set<string>()
  for (const d of dates) {
    if (typeof d === 'string' && DATE_KEY_RE.test(d)) set.add(d)
  }
  return [...set].sort()
}

export function parseCompletedOccurrenceDates(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeCompletedOccurrenceDates(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return []
  }
}

export function serializeCompletedOccurrenceDates(dates: string[] | null | undefined): string | null {
  const list = normalizeCompletedOccurrenceDates(dates)
  return list.length ? JSON.stringify(list) : null
}

export function isOccurrenceDateCompleted(
  dates: string[] | null | undefined,
  dateKey: string
): boolean {
  if (!DATE_KEY_RE.test(dateKey) || !dates?.length) return false
  return dates.includes(dateKey)
}

/** 切换某天完成状态，返回新数组（不突变） */
export function toggleCompletedOccurrenceDate(
  dates: string[] | null | undefined,
  dateKey: string,
  completed: boolean
): string[] {
  const set = new Set(normalizeCompletedOccurrenceDates(dates))
  if (completed) set.add(dateKey)
  else set.delete(dateKey)
  return [...set].sort()
}

/** 是否按「单日实例」完成，而不是整条任务 status */
export function isRecurringCalendarTask(
  recurrence: { type: string } | null | undefined
): boolean {
  return Boolean(recurrence && recurrence.type !== 'none')
}

import dayjs from 'dayjs'

export interface TimelineDaySpan {
  /** YYYY-MM-DD */
  startKey: string
  /** YYYY-MM-DD */
  endKey: string
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = dayjs(iso.slice(0, 10))
  return d.isValid() ? d.format('YYYY-MM-DD') : null
}

function timePart(iso: string | null | undefined, fallback: string): string {
  if (!iso || iso.length < 19) return fallback
  return iso.slice(11, 19)
}

/**
 * 时间线条带：
 * - 有 dueAt：start = createdAt 日，end = dueAt 日（start > end 时钳制为单日 due）
 * - 无 dueAt：单日落在 createdAt 日
 */
export function resolveTimelineSpan(input: {
  createdAt?: string | null
  dueAt?: string | null
}): TimelineDaySpan | null {
  const dueKey = dayKey(input.dueAt)
  if (dueKey) {
    let startKey = dayKey(input.createdAt) ?? dueKey
    if (startKey > dueKey) startKey = dueKey
    return { startKey, endKey: dueKey }
  }
  const createdKey = dayKey(input.createdAt)
  if (createdKey) {
    return { startKey: createdKey, endKey: createdKey }
  }
  return null
}

/** 将日跨度写回任务的 createdAt / dueAt，保留原时刻 */
export function spanToTaskDatetimes(
  span: TimelineDaySpan,
  task: { createdAt: string | null; dueAt: string | null }
): { createdAt: string; dueAt: string | null } {
  const createdTime = timePart(task.createdAt, '09:00:00')
  const dueTime = timePart(task.dueAt, '18:00:00')
  const createdAt = `${span.startKey}T${createdTime}`
  const isPoint = span.startKey === span.endKey
  if (task.dueAt || !isPoint) {
    return { createdAt, dueAt: `${span.endKey}T${dueTime}` }
  }
  return { createdAt, dueAt: null }
}

function shiftKey(key: string, days: number): string {
  return dayjs(key).add(days, 'day').format('YYYY-MM-DD')
}

/** 整体平移 N 天，时长不变 */
export function applyTimelineMove(span: TimelineDaySpan, deltaDays: number): TimelineDaySpan {
  if (deltaDays === 0) return { ...span }
  return {
    startKey: shiftKey(span.startKey, deltaDays),
    endKey: shiftKey(span.endKey, deltaDays)
  }
}

/** 拖左边缘：只改 start，最短 1 天 */
export function applyTimelineResizeLeft(span: TimelineDaySpan, newStartKey: string): TimelineDaySpan {
  const start = dayjs(newStartKey)
  if (!start.isValid()) return { ...span }
  let startKey = start.format('YYYY-MM-DD')
  if (startKey > span.endKey) startKey = span.endKey
  return { startKey, endKey: span.endKey }
}

/** 拖右边缘：只改 end，最短 1 天 */
export function applyTimelineResizeRight(span: TimelineDaySpan, newEndKey: string): TimelineDaySpan {
  const end = dayjs(newEndKey)
  if (!end.isValid()) return { ...span }
  let endKey = end.format('YYYY-MM-DD')
  if (endKey < span.startKey) endKey = span.startKey
  return { startKey: span.startKey, endKey }
}

/** 将日键写成本地日末 ISO（与项目 due 约定接近） */
export function dayKeyToDueIso(key: string): string {
  return `${key}T18:00:00`
}

export function dayKeyToStartIso(key: string): string {
  return `${key}T09:00:00`
}

export function spanDayCount(span: TimelineDaySpan): number {
  return dayjs(span.endKey).diff(dayjs(span.startKey), 'day') + 1
}

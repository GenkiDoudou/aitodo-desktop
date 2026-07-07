import dayjs from 'dayjs'
import type { CreateTaskDto } from './types'
import type { TaskRecurrenceRule, TaskReminderInput } from './task-reminder'
import { buildRemindersFromOffsets, primaryRemindAt } from './task-reminder'

/** 解析时可匹配的分类摘要（id + 展示名） */
export interface AiParseCategoryRef {
  id: string
  name: string
}

/** 规则解析结果：供快捷添加 / AI Dialog 预览与创建任务 DTO 组装 */
export interface AiParsedTaskDraft {
  title: string
  dueAt: string | null
  /** 最早提醒时刻（列表展示用） */
  remindAt: string | null
  reminders: TaskReminderInput[]
  recurrence: TaskRecurrenceRule | null
  category: AiParseCategoryRef | null
  warnings: string[]
  /** 原文中已识别片段，供快捷添加高亮 */
  highlights: AiParseHighlight[]
}

export type AiParseHighlightKind = 'due' | 'remind' | 'recurrence' | 'category'

export interface AiParseHighlight {
  start: number
  end: number
  kind: AiParseHighlightKind
}

export interface AiParseTextSegment {
  text: string
  kind: AiParseHighlightKind | 'plain'
}

export interface AiParseOptions {
  categories: AiParseCategoryRef[]
  /** 单元测试注入「当前时刻」，默认取本机 now */
  now?: dayjs.Dayjs
}

const WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0
}

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12
}

/** 时段缺省小时（滴答清单规则） */
const PERIOD_DEFAULT_HOUR: Record<string, number> = {
  早上: 7,
  上午: 9,
  中午: 12,
  下午: 13,
  傍晚: 17,
  晚上: 20
}

/** ISO 本地时间：yyyy-MM-ddTHH:mm:ss（与仓库 Task 字段一致） */
function toIso(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DDTHH:mm:ss')
}

function parseNumberToken(raw: string | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  if (trimmed in CN_DIGITS) return CN_DIGITS[trimmed]
  const cnHour = trimmed.match(/^([一二三四五六七八九十]+)点?$/)
  if (cnHour && cnHour[1] in CN_DIGITS) return CN_DIGITS[cnHour[1]]
  return null
}

function removeParts(text: string, parts: string[]): string {
  let working = text
  for (const part of parts) {
    if (part) working = working.split(part).join(' ')
  }
  return working
}

/** 去掉已匹配片段并规整空白/标点 */
function cleanupTitle(raw: string): string {
  return raw
    .replace(/[，,。；;、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nearestWeekday(base: dayjs.Dayjs, targetDow: number, hour: number, minute: number): dayjs.Dayjs {
  let cursor = base.startOf('day')
  for (let i = 0; i < 8; i += 1) {
    const candidate = cursor.day(targetDow).hour(hour).minute(minute).second(0)
    const adjusted = candidate.isBefore(cursor.startOf('day')) ? candidate.add(1, 'week') : candidate
    if (!adjusted.isBefore(base)) return adjusted
    cursor = cursor.add(1, 'day')
  }
  return base.add(1, 'week').day(targetDow).hour(hour).minute(minute).second(0)
}

function nearestWorkday(base: dayjs.Dayjs, hour: number, minute: number): dayjs.Dayjs {
  let cursor = base.startOf('day')
  for (let i = 0; i < 14; i += 1) {
    const dow = cursor.day()
    if (dow >= 1 && dow <= 5) {
      const candidate = cursor.hour(hour).minute(minute).second(0)
      if (!candidate.isBefore(base)) return candidate
    }
    cursor = cursor.add(1, 'day')
  }
  return base.add(1, 'day').hour(hour).minute(0).second(0)
}

function nearestWeekendDay(base: dayjs.Dayjs, hour: number, minute: number): dayjs.Dayjs {
  let cursor = base.startOf('day')
  for (let i = 0; i < 14; i += 1) {
    const dow = cursor.day()
    if (dow === 0 || dow === 6) {
      const candidate = cursor.hour(hour).minute(minute).second(0)
      if (!candidate.isBefore(base)) return candidate
    }
    cursor = cursor.add(1, 'day')
  }
  return base.add(1, 'day').hour(hour).minute(0).second(0)
}

function endOfMonth(d: dayjs.Dayjs): dayjs.Dayjs {
  return d.endOf('month').startOf('day')
}

function nearestMonthLastDay(base: dayjs.Dayjs): dayjs.Dayjs {
  const thisMonthLast = endOfMonth(base).hour(9).minute(0).second(0)
  if (!thisMonthLast.isBefore(base)) return thisMonthLast
  return endOfMonth(base.add(1, 'month')).hour(9).minute(0).second(0)
}

function resolveBareHour(hour: number, day: dayjs.Dayjs, base: dayjs.Dayjs): dayjs.Dayjs {
  const am = day.hour(hour).minute(0).second(0)
  if (!am.isBefore(base)) return am
  if (hour >= 1 && hour <= 11) {
    const pm = day.hour(hour + 12).minute(0).second(0)
    if (!pm.isBefore(base)) return pm
  }
  const nextDay = day.add(1, 'day')
  const nextAm = nextDay.hour(hour).minute(0).second(0)
  if (!nextAm.isBefore(base)) return nextAm
  if (hour >= 1 && hour <= 11) {
    return nextDay.hour(hour + 12).minute(0).second(0)
  }
  return nextAm
}

/** 相对日偏移：今天/明天/周X/具体月日等 */
function resolveDayAnchor(text: string, base: dayjs.Dayjs): dayjs.Dayjs | null {
  if (/今天|今日/.test(text)) return base.startOf('day')
  if (/明天|明日/.test(text)) return base.add(1, 'day').startOf('day')
  if (/后天/.test(text)) return base.add(2, 'day').startOf('day')
  if (/大后天/.test(text)) return base.add(3, 'day').startOf('day')

  const weekday = text.match(/(?:周|星期|礼拜)([一二三四五六日天])/)
  if (weekday) {
    const dow = WEEKDAY_MAP[weekday[1]]
    if (dow != null) return nearestWeekday(base, dow, 9, 0).startOf('day')
  }

  const md = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (md) {
    const month = Number(md[1])
    const dayNum = Number(md[2])
    let candidate = base.month(month - 1).date(dayNum).startOf('day')
    if (candidate.isBefore(base.startOf('day'))) {
      candidate = candidate.add(1, 'year')
    }
    return candidate
  }

  const monthOnly = text.match(/(\d{1,2})\s*月(?!\s*\d)/)
  if (monthOnly) {
    const month = Number(monthOnly[1])
    let candidate = base.month(month - 1).date(1).startOf('day')
    if (candidate.isBefore(base.startOf('day'))) {
      candidate = candidate.add(1, 'year')
    }
    return candidate
  }

  const slash = text.match(/(?:^|[^\d])(\d{1,2})[/-](\d{1,2})(?:[^\d]|$)/)
  if (slash) {
    const month = Number(slash[1])
    const dayNum = Number(slash[2])
    let candidate = base.month(month - 1).date(dayNum).startOf('day')
    if (candidate.isBefore(base.startOf('day'))) {
      candidate = candidate.add(1, 'year')
    }
    return candidate
  }

  return null
}

/** 从片段解析时刻 */
function resolveClock(text: string, day: dayjs.Dayjs, base: dayjs.Dayjs): dayjs.Dayjs {
  for (const [period, defaultHour] of Object.entries(PERIOD_DEFAULT_HOUR)) {
    if (text.includes(period) && !/\d{1,2}\s*点/.test(text) && !/\d{1,2}:\d{2}/.test(text)) {
      const candidate = day.hour(defaultHour).minute(0).second(0)
      return candidate.isBefore(base) ? candidate.add(1, 'day') : candidate
    }
  }

  const colon = text.match(/(\d{1,2}):(\d{2})/)
  if (colon) {
    const hour = Number(colon[1])
    const minute = Number(colon[2])
    const candidate = day.hour(hour).minute(minute).second(0)
    return candidate.isBefore(base) ? candidate.add(1, 'day') : candidate
  }

  const half = text.match(
    /(早上|上午|下午|晚上|中午|傍晚)?\s*(\d{1,2}|[一二三四五六七八九十]+)\s*点半/
  )
  if (half) {
    const hour = parseNumberToken(half[2]) ?? 9
    let h = hour
    const period = half[1]
    if (period === '下午' || period === '晚上' || period === '傍晚') {
      if (h < 12) h += 12
    } else if (period === '中午' && h <= 12) {
      h = h === 12 ? 12 : h + 12
    }
    const candidate = day.hour(h).minute(30).second(0)
    return candidate.isBefore(base) ? candidate.add(1, 'day') : candidate
  }

  const full = text.match(
    /(早上|上午|下午|晚上|中午|傍晚)?\s*(\d{1,2}|[一二三四五六七八九十]+)\s*点\s*(\d{1,2})?\s*分?/
  )
  if (full) {
    const hour = parseNumberToken(full[2]) ?? 9
    const minute = full[3] ? Number(full[3]) : 0
    let h = hour
    const period = full[1]
    if (period === '下午' || period === '晚上' || period === '傍晚') {
      if (h < 12) h += 12
    } else if (period === '中午') {
      h = h <= 12 ? (h === 12 ? 12 : h + 12) : h
    } else if (!period) {
      return resolveBareHour(hour, day, base).minute(minute).second(0)
    }
    const candidate = day.hour(h).minute(minute).second(0)
    return candidate.isBefore(base) ? candidate.add(1, 'day') : candidate
  }

  return day.hour(9).minute(0).second(0)
}

function extractDue(
  text: string,
  base: dayjs.Dayjs
): { dueAt: string | null; consumed: string[] } {
  const patterns = [
    /(?:今天|今日|明天|明日|后天|大后天)(?:的)?(?:\s*(?:早上|上午|下午|晚上|中午|傍晚))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})/,
    /(?:今天|今日|明天|明日|后天|大后天)(?:的)?(?:\s*(?:早上|上午|下午|晚上|中午|傍晚))/,
    /(?:周|星期|礼拜)[一二三四五六日天](?:\s*(?:早上|上午|下午|晚上|中午|傍晚))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)?\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})?/,
    /\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*(?:早上|上午|下午|晚上|中午|傍晚))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)?\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})?/,
    /\d{1,2}\s*月(?!\s*\d)/,
    /(?:^|[，,\s])((?:早上|上午|下午|晚上|中午|傍晚)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2}))(?:\s*提醒我)?/,
    /(?:^|[，,\s])(\d{1,2}[/-]\d{1,2})(?:\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|点))?/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const fragment = match[0]
    const day = resolveDayAnchor(fragment, base) ?? base.startOf('day')
    const due = resolveClock(fragment, day, base)
    return { dueAt: toIso(due), consumed: [fragment] }
  }

  return { dueAt: null, consumed: [] }
}

function offsetUnitToMinutes(amount: number, unit: string): number {
  switch (unit) {
    case '分钟':
    case '分':
      return amount
    case '小时':
      return amount * 60
    case '天':
      return amount * 24 * 60
    case '周':
      return amount * 7 * 24 * 60
    case '个月':
    case '月':
      return amount * 30 * 24 * 60
    case '年':
      return amount * 365 * 24 * 60
    default:
      return amount
  }
}

/** 「5分钟后 / 1小时30分钟后」相对当前时刻 */
function extractRelativeAfter(
  text: string,
  base: dayjs.Dayjs
): { dueAt: string | null; consumed: string[] } {
  const compound = text.match(
    /(\d+)\s*小时\s*(\d+)\s*(?:分钟|分)\s*(?:后|之后|以后)/
  )
  if (compound) {
    const due = base
      .add(Number(compound[1]), 'hour')
      .add(Number(compound[2]), 'minute')
    return { dueAt: toIso(due), consumed: [compound[0]] }
  }

  const simple = text.match(
    /(\d+)\s*(分钟|分|小时|天|周|个月|月|年)\s*(?:后|之后|以后)/
  )
  if (simple) {
    const minutes = offsetUnitToMinutes(Number(simple[1]), simple[2])
    const due = base.add(minutes, 'minute')
    return { dueAt: toIso(due), consumed: [simple[0]] }
  }

  return { dueAt: null, consumed: [] }
}

interface RecurrenceExtract {
  recurrence: TaskRecurrenceRule
  dueAnchor: dayjs.Dayjs | null
  consumed: string[]
}

function extractRecurrence(text: string, base: dayjs.Dayjs): RecurrenceExtract | null {
  const rules: Array<{ pattern: RegExp; build: (m: RegExpMatchArray) => RecurrenceExtract }> = [
    {
      pattern: /每月最后(?:一)?天/,
      build: () => ({
        recurrence: { type: 'monthly' },
        dueAnchor: nearestMonthLastDay(base),
        consumed: [text.match(/每月最后(?:一)?天/)![0]]
      })
    },
    {
      pattern: /每月第(\d+)天/,
      build: (m) => {
        const dayNum = Number(m[1])
        let anchor = base.date(dayNum).startOf('day')
        if (anchor.isBefore(base.startOf('day'))) anchor = anchor.add(1, 'month')
        return {
          recurrence: { type: 'monthly' },
          dueAnchor: anchor,
          consumed: [m[0]]
        }
      }
    },
    {
      pattern: /每个工作日|每工作日|工作日重复/,
      build: (m) => ({
        recurrence: { type: 'workdays' },
        dueAnchor: nearestWorkday(base, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每周末(?:重复)?/,
      build: (m) => ({
        recurrence: { type: 'weekend' },
        dueAnchor: nearestWeekendDay(base, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每年(\d{1,2})月(\d{1,2})日/,
      build: (m) => {
        const month = Number(m[1])
        const dayNum = Number(m[2])
        let anchor = base.month(month - 1).date(dayNum).startOf('day')
        if (anchor.isBefore(base.startOf('day'))) anchor = anchor.add(1, 'year')
        return {
          recurrence: { type: 'yearly' },
          dueAnchor: anchor,
          consumed: [m[0]]
        }
      }
    },
    {
      pattern: /每年(\d{1,2})月/,
      build: (m) => {
        const month = Number(m[1])
        let anchor = base.month(month - 1).date(1).startOf('day')
        if (anchor.isBefore(base.startOf('day'))) anchor = anchor.add(1, 'year')
        return {
          recurrence: { type: 'yearly' },
          dueAnchor: anchor,
          consumed: [m[0]]
        }
      }
    },
    {
      pattern: /每(\d+)天/,
      build: (m) => ({
        recurrence: { type: 'custom', interval: Number(m[1]), unit: 'day' },
        dueAnchor: base.startOf('day').hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每(\d+)周/,
      build: (m) => ({
        recurrence: { type: 'custom', interval: Number(m[1]), unit: 'week' },
        dueAnchor: nearestWeekday(base, 1, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每(\d+)月/,
      build: (m) => ({
        recurrence: { type: 'custom', interval: Number(m[1]), unit: 'month' },
        dueAnchor: base.startOf('month').hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每周([一二三四五六日天])/,
      build: (m) => {
        const dow = WEEKDAY_MAP[m[1]]
        return {
          recurrence: { type: 'weekly' },
          dueAnchor: nearestWeekday(base, dow ?? 1, 9, 0),
          consumed: [m[0]]
        }
      }
    },
    {
      pattern: /每周/,
      build: (m) => ({
        recurrence: { type: 'weekly' },
        dueAnchor: nearestWeekday(base, 1, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每天/,
      build: (m) => ({
        recurrence: { type: 'daily' },
        dueAnchor: base.startOf('day').hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    }
  ]

  for (const rule of rules) {
    const match = text.match(rule.pattern)
    if (match) return rule.build(match)
  }
  return null
}

/** 提前提醒：返回相对截止的偏移分钟（含准时 0） */
function extractEarlyReminderOffsets(text: string): { offsets: number[]; consumed: string[] } {
  const consumed: string[] = []
  const offsets = new Set<number>()

  const generic = text.match(/(?:提前|提早)提醒我/)
  if (generic) {
    consumed.push(generic[0])
    offsets.add(0)
    offsets.add(5)
    return { offsets: [...offsets], consumed }
  }

  if (/(?:提前|提早)半小时/.test(text)) {
    const m = text.match(/(?:提前|提早)半小时/)!
    consumed.push(m[0])
    offsets.add(0)
    offsets.add(30)
    return { offsets: [...offsets], consumed }
  }

  const unitMatch = text.match(/(?:提前|提早)\s*(\d+)\s*(分钟|分|小时|天|周)/)
  if (unitMatch) {
    consumed.push(unitMatch[0])
    offsets.add(0)
    offsets.add(offsetUnitToMinutes(Number(unitMatch[1]), unitMatch[2]))
    return { offsets: [...offsets], consumed }
  }

  const hourMatch = text.match(/(?:提前|提早)\s*(\d+)\s*个?\s*小时/)
  if (hourMatch) {
    consumed.push(hourMatch[0])
    offsets.add(0)
    offsets.add(Number(hourMatch[1]) * 60)
    return { offsets: [...offsets], consumed }
  }

  const minMatch = text.match(/(?:提前|提早)\s*(\d+)\s*分钟/)
  if (minMatch) {
    consumed.push(minMatch[0])
    offsets.add(0)
    offsets.add(Number(minMatch[1]))
    return { offsets: [...offsets], consumed }
  }

  return { offsets: [], consumed: [] }
}

function extractCategory(
  text: string,
  categories: AiParseCategoryRef[]
): { category: AiParseCategoryRef | null; consumed: string[] } {
  const consumed: string[] = []
  const explicit = text.match(
    /(?:归到|分到|放入|记在)\s*[「"']?(.+?)[」"']?\s*(?:分类|里|下|类别)/
  )
  if (explicit) {
    const name = explicit[1].trim()
    const hit = categories.find((c) => c.name === name || name.includes(c.name))
    if (hit) {
      consumed.push(explicit[0])
      return { category: hit, consumed }
    }
  }

  const label = text.match(/分类\s*[：:]\s*[「"']?(.+?)[」"']?(?=[，,。；;\s]|$)/)
  if (label) {
    const name = label[1].trim()
    const hit = categories.find((c) => c.name === name || name.includes(c.name))
    if (hit) {
      consumed.push(label[0])
      return { category: hit, consumed }
    }
  }

  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)
  for (const cat of sorted) {
    if (text.includes(cat.name)) {
      consumed.push(cat.name)
      return { category: cat, consumed }
    }
  }

  return { category: null, consumed: [] }
}

function emptyDraft(warnings: string[] = []): AiParsedTaskDraft {
  return {
    title: '',
    dueAt: null,
    remindAt: null,
    reminders: [],
    recurrence: null,
    category: null,
    warnings,
    highlights: []
  }
}

function rangesOverlap(a: AiParseHighlight, b: AiParseHighlight): boolean {
  return a.start < b.end && b.start < a.end
}

/** 在原文中标记已消费片段的位置（避免重复区间） */
function markHighlights(
  source: string,
  fragments: string[],
  kind: AiParseHighlightKind,
  highlights: AiParseHighlight[]
): void {
  for (const fragment of fragments) {
    if (!fragment?.trim()) continue
    let searchFrom = 0
    while (searchFrom < source.length) {
      const idx = source.indexOf(fragment, searchFrom)
      if (idx < 0) break
      const candidate: AiParseHighlight = { start: idx, end: idx + fragment.length, kind }
      if (!highlights.some((h) => rangesOverlap(h, candidate))) {
        highlights.push(candidate)
        break
      }
      searchFrom = idx + 1
    }
  }
}

/** 将高亮区间切分为可渲染文本段 */
export function buildParseTextSegments(
  source: string,
  highlights: AiParseHighlight[]
): AiParseTextSegment[] {
  if (!source) return []
  const sorted = [...highlights].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: AiParseHighlight[] = []
  for (const h of sorted) {
    const last = merged[merged.length - 1]
    if (last && rangesOverlap(last, h)) continue
    merged.push(h)
  }

  const segments: AiParseTextSegment[] = []
  let cursor = 0
  for (const h of merged) {
    if (h.start > cursor) {
      segments.push({ text: source.slice(cursor, h.start), kind: 'plain' })
    }
    if (h.end > h.start) {
      segments.push({ text: source.slice(h.start, h.end), kind: h.kind })
    }
    cursor = Math.max(cursor, h.end)
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), kind: 'plain' })
  }
  return segments
}

/**
 * 本地规则解析：从一句中文中提取标题、截止、提醒、循环、分类。
 * 不发起网络请求；供快捷添加与 AI 对话框共用。
 */
export function parseAiTaskInput(input: string, options: AiParseOptions): AiParsedTaskDraft {
  const warnings: string[] = []
  const base = options.now ?? dayjs()
  let working = input.trim()

  if (!working) {
    return emptyDraft(['请输入任务描述'])
  }

  let recurrence: TaskRecurrenceRule | null = null
  let dueAt: string | null = null

  const recurrenceHit = extractRecurrence(working, base)
  if (recurrenceHit) {
    recurrence = recurrenceHit.recurrence
    working = removeParts(working, recurrenceHit.consumed)
    if (recurrenceHit.dueAnchor) {
      dueAt = toIso(recurrenceHit.dueAnchor)
    }
  }

  const relativeAfter = extractRelativeAfter(working, base)
  if (relativeAfter.dueAt) {
    dueAt = relativeAfter.dueAt
    working = removeParts(working, relativeAfter.consumed)
  }

  const earlyReminder = extractEarlyReminderOffsets(working)
  working = removeParts(working, earlyReminder.consumed)

  const dueHit = extractDue(working, base)
  if (dueHit.dueAt) {
    dueAt = dueHit.dueAt
    working = removeParts(working, dueHit.consumed)
  }

  const wantsRemind = /提醒我|记得提醒|别忘了/.test(input)

  const { category, consumed: catConsumed } = extractCategory(working, options.categories)
  working = removeParts(working, catConsumed)

  let reminders: TaskReminderInput[] = []
  if (dueAt && earlyReminder.offsets.length > 0) {
    reminders = buildRemindersFromOffsets(dueAt, earlyReminder.offsets)
  } else if (dueAt && wantsRemind) {
    reminders = buildRemindersFromOffsets(dueAt, [0])
  }

  working = working
    .replace(/(?:提前|提早)提醒我/g, ' ')
    .replace(/(?:提前|提早)\s*\d+\s*(?:分钟|分|小时|天|周|个半小时)?/g, ' ')
    .replace(/提醒我/g, ' ')
    .replace(/记得提醒/g, ' ')
    .replace(/别忘了/g, ' ')
    .replace(/重复/g, ' ')

  let title = cleanupTitle(working)
  if (!title) {
    const fallback = input.split(/[，,。]/)[0]?.trim() || input.trim()
    title = fallback.slice(0, 32)
  }
  if (title.length > 200) {
    title = title.slice(0, 200)
    warnings.push('标题过长，已截断至 200 字')
  }

  if (earlyReminder.offsets.length > 0 && !dueAt) {
    warnings.push('已识别提醒提前量，但未识别截止时间，请补充或创建后编辑')
  }

  if (!dueAt && /点|月|日|今天|明天|后天|周|每/.test(input)) {
    warnings.push('未能完全识别时间，创建后可在详情中修改')
  }

  const remindAt = reminders.length ? primaryRemindAt(reminders) : null

  const highlights: AiParseHighlight[] = []
  if (recurrenceHit) markHighlights(input, recurrenceHit.consumed, 'recurrence', highlights)
  if (relativeAfter.consumed.length) markHighlights(input, relativeAfter.consumed, 'due', highlights)
  if (earlyReminder.consumed.length) markHighlights(input, earlyReminder.consumed, 'remind', highlights)
  if (dueHit.consumed.length) markHighlights(input, dueHit.consumed, 'due', highlights)
  if (catConsumed.length) markHighlights(input, catConsumed, 'category', highlights)
  if (wantsRemind && earlyReminder.consumed.length === 0) {
    for (const phrase of ['记得提醒', '别忘了', '提醒我']) {
      markHighlights(input, [phrase], 'remind', highlights)
    }
  }

  return { title, dueAt, remindAt, reminders, recurrence, category, warnings, highlights }
}

/** 将解析结果组装为 CreateTaskDto */
export function buildCreateTaskDtoFromParsed(
  draft: AiParsedTaskDraft,
  overrides?: Partial<CreateTaskDto>
): CreateTaskDto {
  const dto: CreateTaskDto = {
    ...overrides,
    title: draft.title,
    dueAt: draft.dueAt,
    recurrence: draft.recurrence,
    categoryId: draft.category?.id ?? overrides?.categoryId ?? null
  }

  if (draft.reminders.length > 0) {
    dto.reminders = draft.reminders
    dto.remindAt = primaryRemindAt(draft.reminders)
  } else if (draft.remindAt) {
    dto.remindAt = draft.remindAt
  }

  return dto
}

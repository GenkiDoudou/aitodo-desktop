import dayjs from 'dayjs'

/** timor.tech 年度节假日接口单条记录 */
export interface TimorHolidayEntry {
  holiday: boolean
  name: string
  wage?: number
  date?: string
}

export interface TimorYearHolidayResponse {
  code: number
  holiday: Record<string, TimorHolidayEntry | null>
}

/** 日历展示用：法定放假 / 调休上班 */
export type HolidayCalendarKind = 'holiday' | 'workday'

export interface HolidayCalendarDay {
  date: string
  kind: HolidayCalendarKind
  name: string
}

/** 单年磁盘缓存元信息 */
export interface HolidayYearMeta {
  year: number
  /** 缓存文件 mtime ISO；仅内存无文件时为 null */
  updatedAt: string | null
}

/** 节假日数据来源：同步服务器 / Timor 直连 */
export type HolidayDataSourceId = 'server' | 'timor.tech'

/** 节假日缓存总览（设置页状态区） */
export interface HolidayCacheStatus {
  source: HolidayDataSourceId
  sourceLabel: string
  cachedYears: number[]
  yearsMeta: HolidayYearMeta[]
}

export const HOLIDAY_DATA_SOURCE_TIMOR = 'timor.tech' as const
export const HOLIDAY_DATA_SOURCE_SERVER = 'server' as const

/** @deprecated 兼容旧引用，等同 TIMOR */
export const HOLIDAY_DATA_SOURCE = HOLIDAY_DATA_SOURCE_TIMOR

export const HOLIDAY_DATA_SOURCE_LABEL_TIMOR = '中国法定节假日（timor.tech）'
export const HOLIDAY_DATA_SOURCE_LABEL_SERVER = '中国法定节假日（同步服务器）'

/** @deprecated 兼容旧引用 */
export const HOLIDAY_DATA_SOURCE_LABEL = HOLIDAY_DATA_SOURCE_LABEL_TIMOR

export function holidaySourceLabel(source: HolidayDataSourceId): string {
  return source === 'server' ? HOLIDAY_DATA_SOURCE_LABEL_SERVER : HOLIDAY_DATA_SOURCE_LABEL_TIMOR
}

/** 合法年份：整数且 2000–2100 */
export function normalizeHolidayYears(years: unknown): number[] {
  if (!Array.isArray(years)) return []
  const out: number[] = []
  for (const y of years) {
    if (typeof y !== 'number' || !Number.isInteger(y)) continue
    if (y < 2000 || y > 2100) continue
    if (!out.includes(y)) out.push(y)
  }
  return out.sort((a, b) => a - b)
}

const TIMOR_HOLIDAY_YEAR_URL = 'https://timor.tech/api/holiday/year'

/** 年度接口 URL（文档要求整年后加斜杠） */
export function timorHolidayYearUrl(year: number): string {
  return `${TIMOR_HOLIDAY_YEAR_URL}/${year}/`
}

function toFullDate(year: number, mmdd: string, entryDate?: string): string | null {
  if (entryDate && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return entryDate
  const parts = mmdd.split('-')
  if (parts.length !== 2) return null
  return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

/**
 * 将 timor 年度接口转为日历标注图：
 * - holiday=true → 法定放假（休）
 * - holiday=false → 调休补班（班）
 */
export function buildHolidayCalendarMap(
  response: TimorYearHolidayResponse,
  year: number
): Map<string, HolidayCalendarDay> {
  const map = new Map<string, HolidayCalendarDay>()
  if (response.code !== 0 || !response.holiday) return map
  for (const [mmdd, entry] of Object.entries(response.holiday)) {
    if (!entry || typeof entry.holiday !== 'boolean') continue
    const full = toFullDate(year, mmdd, entry.date)
    if (!full) continue
    map.set(full, {
      date: full,
      kind: entry.holiday ? 'holiday' : 'workday',
      name: entry.name || (entry.holiday ? '法定节假日' : '调休上班')
    })
  }
  return map
}

/**
 * 将 timor 年度接口的 MM-DD 键转为 YYYY-MM-DD 映射。
 * 仅保留 holiday=true 的法定节假日（排除调休补班日）。
 */
export function buildLegalHolidayDateMap(
  response: TimorYearHolidayResponse,
  year: number
): Map<string, TimorHolidayEntry> {
  const map = new Map<string, TimorHolidayEntry>()
  const calendar = buildHolidayCalendarMap(response, year)
  for (const [date, day] of calendar) {
    if (day.kind !== 'holiday') continue
    map.set(date, {
      holiday: true,
      name: day.name,
      date
    })
  }
  return map
}

/** 从日历全量图中提取法定放假日（供循环提醒） */
export function legalHolidayMapFromCalendar(
  calendar: Map<string, HolidayCalendarDay>
): Map<string, TimorHolidayEntry> {
  const map = new Map<string, TimorHolidayEntry>()
  for (const [date, day] of calendar) {
    if (day.kind !== 'holiday') continue
    map.set(date, { holiday: true, name: day.name, date })
  }
  return map
}

/**
 * 从已加载的多年数据中，查找 strictly after fromIso 的下一个法定节假日 due 时间（保留时分秒）。
 */
export function findNextLegalHolidayDueAfter(
  fromIso: string,
  yearMaps: Map<number, Map<string, TimorHolidayEntry>>,
  maxDays = 400
): string | null {
  const from = dayjs(fromIso)
  if (!from.isValid()) return null
  let cursor = from.add(1, 'day').startOf('day')
  for (let i = 0; i < maxDays; i++) {
    const y = cursor.year()
    const map = yearMaps.get(y)
    const key = cursor.format('YYYY-MM-DD')
    if (map?.has(key)) {
      return cursor
        .hour(from.hour())
        .minute(from.minute())
        .second(from.second())
        .format('YYYY-MM-DDTHH:mm:ss')
    }
    cursor = cursor.add(1, 'day')
  }
  return null
}

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

const TIMOR_HOLIDAY_YEAR_URL = 'https://timor.tech/api/holiday/year'

/** 年度接口 URL（文档要求整年后加斜杠） */
export function timorHolidayYearUrl(year: number): string {
  return `${TIMOR_HOLIDAY_YEAR_URL}/${year}/`
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
  if (response.code !== 0 || !response.holiday) return map
  for (const [mmdd, entry] of Object.entries(response.holiday)) {
    if (!entry?.holiday) continue
    const parts = mmdd.split('-')
    if (parts.length !== 2) continue
    const full = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    map.set(full, { ...entry, date: entry.date ?? full })
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

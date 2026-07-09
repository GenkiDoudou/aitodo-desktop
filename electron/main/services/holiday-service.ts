import fs from 'fs'
import path from 'path'
import {
  buildHolidayCalendarMap,
  findNextLegalHolidayDueAfter,
  legalHolidayMapFromCalendar,
  timorHolidayYearUrl,
  type HolidayCalendarDay,
  type TimorHolidayEntry,
  type TimorYearHolidayResponse
} from '@shared/timor-holiday'
import { resolveDataDir } from '../data-path'

const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/**
 * 从 [timor.tech 免费节假日 API](http://timor.tech/api/holiday/) 拉取并缓存节假日数据。
 * 主进程专用：渲染进程不直接请求外网。
 */
export class HolidayService {
  private readonly cacheDir: string
  /** 含法定放假 + 调休上班的全量日历标注 */
  private readonly calendarMemory = new Map<number, Map<string, HolidayCalendarDay>>()

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? path.join(resolveDataDir(), 'holiday-cache')
  }

  /** 计算下一次法定节假日对应的 dueAt（保留原时刻） */
  async nextLegalHolidayDueAfter(fromIso: string): Promise<string | null> {
    const fromYear = new Date(fromIso.replace(' ', 'T')).getFullYear()
    await this.ensureYearsLoaded([fromYear, fromYear + 1])
    const legalByYear = new Map<number, Map<string, TimorHolidayEntry>>()
    for (const y of [fromYear, fromYear + 1]) {
      const cal = this.calendarMemory.get(y)
      if (cal) legalByYear.set(y, legalHolidayMapFromCalendar(cal))
    }
    return findNextLegalHolidayDueAfter(fromIso, legalByYear)
  }

  /** 返回多年日历标注（YYYY-MM-DD → day）供月历展示 */
  async getCalendarMarks(years: number[]): Promise<Record<string, HolidayCalendarDay>> {
    await this.ensureYearsLoaded(years)
    const out: Record<string, HolidayCalendarDay> = {}
    for (const year of [...new Set(years)]) {
      const map = this.calendarMemory.get(year)
      if (!map) continue
      for (const [date, day] of map) {
        out[date] = day
      }
    }
    return out
  }

  private async ensureYearsLoaded(years: number[]): Promise<void> {
    const unique = [...new Set(years)]
    await Promise.all(unique.map((y) => this.loadYear(y)))
  }

  private async loadYear(year: number): Promise<Map<string, HolidayCalendarDay>> {
    if (this.calendarMemory.has(year)) {
      return this.calendarMemory.get(year)!
    }
    // v2 缓存含补班日；旧版仅法定假的缓存文件不再复用
    const filePath = path.join(this.cacheDir, `${year}-calendar-v2.json`)
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath)
        if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
            string,
            HolidayCalendarDay
          >
          const map = new Map(Object.entries(parsed))
          this.calendarMemory.set(year, map)
          return map
        }
      }
    } catch {
      /* 缓存损坏则重新拉取 */
    }

    const map = await this.fetchYearFromApi(year)
    fs.mkdirSync(this.cacheDir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(map)), 'utf8')
    this.calendarMemory.set(year, map)
    return map
  }

  private async fetchYearFromApi(year: number): Promise<Map<string, HolidayCalendarDay>> {
    const url = timorHolidayYearUrl(year)
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      throw new Error(`节假日 API 请求失败: ${res.status}`)
    }
    const data = (await res.json()) as TimorYearHolidayResponse
    return buildHolidayCalendarMap(data, year)
  }

  /** 测试用：注入内存数据 */
  seedYearForTest(year: number, map: Map<string, TimorHolidayEntry>): void {
    const calendar = new Map<string, HolidayCalendarDay>()
    for (const [date, entry] of map) {
      calendar.set(date, {
        date,
        kind: entry.holiday ? 'holiday' : 'workday',
        name: entry.name
      })
    }
    this.calendarMemory.set(year, calendar)
  }

  clearMemory(): void {
    this.calendarMemory.clear()
  }
}

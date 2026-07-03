import fs from 'fs'
import path from 'path'
import {
  buildLegalHolidayDateMap,
  findNextLegalHolidayDueAfter,
  timorHolidayYearUrl,
  type TimorHolidayEntry,
  type TimorYearHolidayResponse
} from '@shared/timor-holiday'
import { resolveDataDir } from '../data-path'

const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/**
 * 从 [timor.tech 免费节假日 API](http://timor.tech/api/holiday/) 拉取并缓存法定节假日数据。
 * 主进程专用：渲染进程不直接请求外网。
 */
export class HolidayService {
  private readonly cacheDir: string
  private readonly memory = new Map<number, Map<string, TimorHolidayEntry>>()

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? path.join(resolveDataDir(), 'holiday-cache')
  }

  /** 计算下一次法定节假日对应的 dueAt（保留原时刻） */
  async nextLegalHolidayDueAfter(fromIso: string): Promise<string | null> {
    const fromYear = new Date(fromIso.replace(' ', 'T')).getFullYear()
    await this.ensureYearsLoaded([fromYear, fromYear + 1])
    return findNextLegalHolidayDueAfter(fromIso, this.memory)
  }

  private async ensureYearsLoaded(years: number[]): Promise<void> {
    const unique = [...new Set(years)]
    await Promise.all(unique.map((y) => this.loadYear(y)))
  }

  private async loadYear(year: number): Promise<Map<string, TimorHolidayEntry>> {
    if (this.memory.has(year)) {
      return this.memory.get(year)!
    }
    const filePath = path.join(this.cacheDir, `${year}.json`)
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath)
        if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
            string,
            TimorHolidayEntry
          >
          const map = new Map(Object.entries(parsed))
          this.memory.set(year, map)
          return map
        }
      }
    } catch {
      /* 缓存损坏则重新拉取 */
    }

    const map = await this.fetchYearFromApi(year)
    fs.mkdirSync(this.cacheDir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(map)), 'utf8')
    this.memory.set(year, map)
    return map
  }

  private async fetchYearFromApi(year: number): Promise<Map<string, TimorHolidayEntry>> {
    const url = timorHolidayYearUrl(year)
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      throw new Error(`节假日 API 请求失败: ${res.status}`)
    }
    const data = (await res.json()) as TimorYearHolidayResponse
    return buildLegalHolidayDateMap(data, year)
  }

  /** 测试用：注入内存数据 */
  seedYearForTest(year: number, map: Map<string, TimorHolidayEntry>): void {
    this.memory.set(year, map)
  }

  clearMemory(): void {
    this.memory.clear()
  }
}

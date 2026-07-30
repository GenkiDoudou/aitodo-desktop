import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { HolidayService } from './holiday-service'
import { normalizeHolidayYears } from '@shared/timor-holiday'

describe('normalizeHolidayYears', () => {
  it('filters invalid years', () => {
    expect(normalizeHolidayYears([2026, 1999, 2101, 2026, 'x', 2025.5])).toEqual([2026])
    expect(normalizeHolidayYears([2025, 2026])).toEqual([2025, 2026])
    expect(normalizeHolidayYears(null)).toEqual([])
  })
})

describe('HolidayService', () => {
  let cacheDir: string
  let service: HolidayService

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-test-'))
    service = new HolidayService(cacheDir)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  it('nextLegalHolidayDueAfter uses seeded year data without network', async () => {
    service.seedYearForTest(
      2026,
      new Map([['2026-10-01', { holiday: true, name: '国庆节' }]])
    )
    service.seedYearForTest(2027, new Map())
    const next = await service.nextLegalHolidayDueAfter('2026-09-15T09:00:00')
    expect(next).toBe('2026-10-01T09:00:00')
  })

  it('getCalendarMarks returns holiday and makeup workday', async () => {
    service.seedYearForTest(
      2026,
      new Map([
        ['2026-10-01', { holiday: true, name: '国庆节' }],
        ['2026-10-07', { holiday: false, name: '国庆后补班' }]
      ])
    )
    const marks = await service.getCalendarMarks([2026])
    expect(marks['2026-10-01']).toEqual({
      date: '2026-10-01',
      kind: 'holiday',
      name: '国庆节'
    })
    expect(marks['2026-10-07']).toEqual({
      date: '2026-10-07',
      kind: 'workday',
      name: '国庆后补班'
    })
  })

  it('getStatus returns empty when no cache files', () => {
    const status = service.getStatus()
    expect(status.source).toBe('timor.tech')
    expect(status.cachedYears).toEqual([])
    expect(status.yearsMeta).toEqual([])
  })

  it('getStatus reads cache file mtime', () => {
    service.writeCacheFileForTest(2026, {
      '2026-10-01': { date: '2026-10-01', kind: 'holiday', name: '国庆节' }
    })
    const status = service.getStatus()
    expect(status.cachedYears).toEqual([2026])
    expect(status.yearsMeta[0]?.year).toBe(2026)
    expect(status.yearsMeta[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('refreshYears clears cache, refetches, and updates status', async () => {
    service.writeCacheFileForTest(2026, {
      '2026-01-01': { date: '2026-01-01', kind: 'holiday', name: '旧数据' }
    })
    const before = service.getStatus().yearsMeta[0]?.updatedAt
    expect(before).toBeTruthy()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 0,
          holiday: {
            '10-01': { holiday: true, name: '国庆节', date: '2026-10-01' },
            '10-07': { holiday: false, name: '国庆后补班', date: '2026-10-07' }
          }
        })
      }))
    )

    // 保证 mtime 可区分
    await new Promise((r) => setTimeout(r, 20))
    const { marks, status } = await service.refreshYears([2026, 1999])
    expect(marks['2026-10-01']?.name).toBe('国庆节')
    expect(marks['2026-10-07']?.kind).toBe('workday')
    expect(marks['2026-01-01']).toBeUndefined()
    expect(status.cachedYears).toEqual([2026])
    expect(status.yearsMeta[0]?.updatedAt).toBeTruthy()
    expect(status.source).toBe('timor.tech')
    expect(fetch).toHaveBeenCalled()
  })

  it('uses server URL when auth resolver returns credentials', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/holidays/year/')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'success',
            data: {
              year: 2026,
              source: 'timor.tech',
              days: {
                '2026-10-01': { date: '2026-10-01', kind: 'holiday', name: '国庆节' }
              }
            }
          })
        }
      }
      throw new Error('should not hit timor')
    })
    vi.stubGlobal('fetch', fetchMock)
    service = new HolidayService(cacheDir, () => ({
      baseUrl: 'http://127.0.0.1:8088',
      accessToken: 'tok'
    }))
    const marks = await service.getCalendarMarks([2026])
    expect(marks['2026-10-01']?.kind).toBe('holiday')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/holidays/year/2026')
    const status = service.getStatus()
    expect(status.source).toBe('server')
    expect(status.sourceLabel).toContain('同步服务器')
  })

  it('falls back to Timor when server fetch fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/holidays/')) {
        return { ok: false, status: 500, json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          holiday: { '10-01': { holiday: true, name: '国庆节', date: '2026-10-01' } }
        })
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    service = new HolidayService(cacheDir, () => ({
      baseUrl: 'http://127.0.0.1:8088',
      accessToken: 'tok'
    }))
    const marks = await service.getCalendarMarks([2026])
    expect(marks['2026-10-01']?.kind).toBe('holiday')
    expect(service.getStatus().source).toBe('timor.tech')
  })
})

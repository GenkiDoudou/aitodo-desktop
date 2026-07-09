import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { HolidayService } from './holiday-service'

describe('HolidayService', () => {
  let cacheDir: string
  let service: HolidayService

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holiday-test-'))
    service = new HolidayService(cacheDir)
  })

  afterEach(() => {
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
})

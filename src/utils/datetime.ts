import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 与后端约定：本地 ISO 字符串 yyyy-MM-ddTHH:mm:ss */
export const ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ss'

/** 展示用：按中国时区格式化为 YYYY/MM/DD HH:mm */
export function formatChinaDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = dayjs(iso)
  if (!d.isValid()) return iso
  return d.tz('Asia/Shanghai').format('YYYY/MM/DD HH:mm')
}

export function toIso(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null
  const d = dayjs(value)
  return d.isValid() ? d.format(ISO_FORMAT) : null
}

export function formatIsoReadable(iso: string | null): string {
  if (!iso) return '未设置'
  const d = dayjs(iso)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : iso
}

export function isoAt(date: dayjs.Dayjs): string {
  return date.format(ISO_FORMAT)
}

/** 本周末：若今天已是周末则取今天 18:00，否则取本周六 18:00 */
export function nextWeekendEvening(): string {
  const now = dayjs()
  const dow = now.day()
  if (dow === 0 || dow === 6) {
    return isoAt(now.hour(18).minute(0).second(0))
  }
  const daysUntilSat = 6 - dow
  return isoAt(now.add(daysUntilSat, 'day').hour(18).minute(0).second(0))
}

/** 下周一 09:00 */
export function nextMondayMorning(): string {
  const now = dayjs()
  const dow = now.day()
  const daysUntilMon = dow === 0 ? 1 : 8 - dow
  return isoAt(now.add(daysUntilMon, 'day').hour(9).minute(0).second(0))
}

export function assertRemindBeforeDue(
  remindAt: string | null,
  dueAt: string | null
): string | null {
  if (remindAt && dueAt && remindAt > dueAt) {
    return '提醒时间不能晚于截止时间'
  }
  return null
}

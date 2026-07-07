import dayjs from 'dayjs'
import type { IsoDateTime, Task } from './types'
import {
  DEFAULT_REPORT_CONFIG,
  type SummaryReportConfig
} from './summary-report-config'

export type { SummaryReportConfig, SummaryReportSection, SummaryTaskFilter, SummaryTimeScope, SummaryReportTemplate } from './summary-report-config'
export {
  SUMMARY_REPORT_TEMPLATES,
  SUMMARY_TASK_FILTER_LABELS,
  SUMMARY_TIME_SCOPE_LABELS,
  DEFAULT_REPORT_CONFIG,
  applySummaryReportTemplate,
  cloneReportConfig,
  createReportSection,
  describeReportConfig,
  getSummaryReportTemplate,
  normalizeReportConfig,
  buildReportSummaryText,
  buildSectionTasksSummaryText,
  resolveSectionTimeBounds
} from './summary-report-config'

export type SummaryScheduleType = 'daily' | 'weekly' | 'monthly'

export interface ScheduledSummary {
  id: string
  name: string
  /** 空数组表示全部清单 */
  categoryIds: string[]
  scheduleType: SummaryScheduleType
  /** 发送时刻 HH:mm */
  sendTime: string
  /** weekly：0=周日 … 6=周六 */
  sendWeekday: number | null
  /** monthly：1–31 */
  sendDay: number | null
  useLlm: boolean
  /** 汇总优化提示词；useLlm 时使用 */
  promptText: string | null
  /** 报告模板与区块配置 */
  reportConfig: SummaryReportConfig
  enabled: boolean
  lastSentAt: IsoDateTime | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface CreateScheduledSummaryDto {
  name: string
  categoryIds?: string[]
  scheduleType: SummaryScheduleType
  sendTime: string
  sendWeekday?: number | null
  sendDay?: number | null
  useLlm?: boolean
  promptText?: string | null
  reportConfig?: SummaryReportConfig
  enabled?: boolean
}

export interface UpdateScheduledSummaryDto {
  name?: string
  categoryIds?: string[]
  scheduleType?: SummaryScheduleType
  sendTime?: string
  sendWeekday?: number | null
  sendDay?: number | null
  useLlm?: boolean
  promptText?: string | null
  reportConfig?: SummaryReportConfig
  enabled?: boolean
}

export const SUMMARY_SCHEDULE_LABELS: Record<SummaryScheduleType, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月'
}

export const DEFAULT_SUMMARY_PROMPT = `你是 aiTodo 的任务汇总助手。请根据用户提供的「任务汇总数据」生成简洁、有条理的中文汇总。

要求：
1. 按报告中的区块与清单/分类分组展示
2. 保留任务标题，可补充完成时间或截止时间
3. 语气简洁专业，适合每日/每周回顾
4. 若某区块无任务，简要说明即可
5. 直接输出正文，不要 markdown 代码块`

/** 将时间选择器/IPC 各类输入规范为 HH:mm */
export function normalizeSendTime(raw: unknown, fallback = '09:00'): string {
  if (raw == null || raw === '') return fallback
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return dayjs(raw).format('HH:mm')
  }
  if (typeof raw === 'object' && raw !== null) {
    const maybeDayjs = raw as { format?: (pattern: string) => string; $d?: Date }
    if (typeof maybeDayjs.format === 'function') {
      try {
        const formatted = maybeDayjs.format('HH:mm')
        if (/^\d{2}:\d{2}$/.test(formatted)) return formatted
      } catch {
        /* 非 dayjs 对象 */
      }
    }
    if (maybeDayjs.$d instanceof Date && !Number.isNaN(maybeDayjs.$d.getTime())) {
      return dayjs(maybeDayjs.$d).format('HH:mm')
    }
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const hm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
    if (hm) {
      return `${hm[1].padStart(2, '0')}:${hm[2]}`
    }
    const iso = trimmed.match(/T(\d{2}):(\d{2})/)
    if (iso) {
      return `${iso[1]}:${iso[2]}`
    }
  }
  return fallback
}

/** IPC 传输前转为 plain object，避免 Vue reactive Proxy 无法结构化克隆 */
export function toPlainScheduledSummaryDto<T extends Record<string, unknown>>(dto: T): T {
  return JSON.parse(JSON.stringify(dto)) as T
}

/** 汇总周期：从 periodFrom（含）到 periodTo（不含）的完成任务 */
export function summaryPeriodBounds(
  scheduleType: SummaryScheduleType,
  now: dayjs.Dayjs,
  lastSentAt: string | null
): { from: string; to: string } {
  const to = now.format('YYYY-MM-DDTHH:mm:ss')
  if (lastSentAt) {
    return { from: lastSentAt, to }
  }
  switch (scheduleType) {
    case 'daily':
      return { from: now.subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss'), to }
    case 'weekly':
      return { from: now.subtract(7, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss'), to }
    case 'monthly':
      return { from: now.subtract(1, 'month').startOf('day').format('YYYY-MM-DDTHH:mm:ss'), to }
  }
}

/** 是否到达发送时刻（分钟精度） */
export function shouldSendSummaryNow(
  summary: Pick<
    ScheduledSummary,
    'scheduleType' | 'sendTime' | 'sendWeekday' | 'sendDay' | 'lastSentAt' | 'enabled'
  >,
  now: dayjs.Dayjs = dayjs()
): boolean {
  if (!summary.enabled) return false

  const [hh, mm] = summary.sendTime.split(':').map((v) => Number(v))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false

  const scheduled = now.hour(hh).minute(mm).second(0).millisecond(0)
  if (now.isBefore(scheduled)) return false

  if (summary.scheduleType === 'weekly') {
    if (summary.sendWeekday == null || now.day() !== summary.sendWeekday) return false
  }
  if (summary.scheduleType === 'monthly') {
    if (summary.sendDay == null || now.date() !== summary.sendDay) return false
  }

  if (summary.lastSentAt) {
    const last = dayjs(summary.lastSentAt)
    if (last.isSame(now, 'day') && summary.scheduleType === 'daily') return false
    if (last.isSame(now, 'week') && summary.scheduleType === 'weekly') return false
    if (last.isSame(now, 'month') && summary.scheduleType === 'monthly') return false
  }

  return true
}

export function buildCompletedTasksSummaryText(
  tasks: Task[],
  categoryNames: Map<string, string>
): string {
  if (!tasks.length) {
    return '本周期暂无已完成任务。'
  }

  const byCategory = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = task.categoryId ?? '__none__'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(task)
  }

  const lines: string[] = []
  for (const [catKey, list] of byCategory) {
    const label = catKey === '__none__' ? '未分类' : categoryNames.get(catKey) ?? '未分类'
    lines.push(`【${label}】${list.length} 项`)
    for (const t of list) {
      const done = t.completedAt?.slice(0, 16).replace('T', ' ') ?? ''
      lines.push(`· ${t.title}${done ? `（完成 ${done}）` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
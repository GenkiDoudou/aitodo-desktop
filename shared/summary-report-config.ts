import dayjs from 'dayjs'
import type { Task } from './types'
import type { SummaryScheduleType } from './scheduled-summary'
import { summaryPeriodBounds } from './scheduled-summary'
import { endOfWeekSunday, startOfWeekMonday } from './smart-list'

/** 区块统计的任务范围 */
export type SummaryTaskFilter = 'completed' | 'pending' | 'overdue'

/** 区块统计的时间范围 */
export type SummaryTimeScope =
  | 'since_last'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_7_days'
  | 'last_30_days'

export interface SummaryReportSection {
  id: string
  title: string
  taskFilter: SummaryTaskFilter
  timeScope: SummaryTimeScope
  enabled: boolean
}

export interface SummaryReportConfig {
  templateId: string | null
  sections: SummaryReportSection[]
}

export interface SummaryReportTemplate {
  id: string
  name: string
  description: string
  config: SummaryReportConfig
}

export const SUMMARY_TASK_FILTER_LABELS: Record<SummaryTaskFilter, string> = {
  completed: '已完成',
  pending: '未完成',
  overdue: '已逾期'
}

export const SUMMARY_TIME_SCOPE_LABELS: Record<SummaryTimeScope, string> = {
  since_last: '自上次发送以来',
  today: '今天',
  this_week: '本周',
  this_month: '本月',
  last_7_days: '最近 7 天',
  last_30_days: '最近 30 天'
}

export const DEFAULT_REPORT_CONFIG: SummaryReportConfig = {
  templateId: 'daily_completed',
  sections: [
    {
      id: 'completed_since_last',
      title: '已完成',
      taskFilter: 'completed',
      timeScope: 'since_last',
      enabled: true
    }
  ]
}

function section(
  id: string,
  title: string,
  taskFilter: SummaryTaskFilter,
  timeScope: SummaryTimeScope
): SummaryReportSection {
  return { id, title, taskFilter, timeScope, enabled: true }
}

export const SUMMARY_REPORT_TEMPLATES: SummaryReportTemplate[] = [
  {
    id: 'daily_completed',
    name: '每日已完成回顾',
    description: '汇总自上次发送以来已完成的任务',
    config: {
      templateId: 'daily_completed',
      sections: [section('completed_since_last', '已完成', 'completed', 'since_last')]
    }
  },
  {
    id: 'weekly_completed',
    name: '本周已完成',
    description: '汇总本周内完成的任务',
    config: {
      templateId: 'weekly_completed',
      sections: [section('completed_week', '本周已完成', 'completed', 'this_week')]
    }
  },
  {
    id: 'weekly_pending',
    name: '本周未完成',
    description: '汇总本周内待办与进行中的任务',
    config: {
      templateId: 'weekly_pending',
      sections: [section('pending_week', '本周未完成', 'pending', 'this_week')]
    }
  },
  {
    id: 'weekly_overview',
    name: '本周工作全景',
    description: '同时包含本周已完成、未完成与当前逾期',
    config: {
      templateId: 'weekly_overview',
      sections: [
        section('completed_week', '本周已完成', 'completed', 'this_week'),
        section('pending_week', '本周未完成', 'pending', 'this_week'),
        section('overdue_now', '已逾期', 'overdue', 'today')
      ]
    }
  },
  {
    id: 'monthly_completed',
    name: '本月已完成',
    description: '汇总本月内完成的任务',
    config: {
      templateId: 'monthly_completed',
      sections: [section('completed_month', '本月已完成', 'completed', 'this_month')]
    }
  },
  {
    id: 'custom',
    name: '自定义',
    description: '自行勾选区块并配置统计范围',
    config: {
      templateId: 'custom',
      sections: [
        section('completed_since_last', '已完成', 'completed', 'since_last'),
        section('pending_week', '未完成', 'pending', 'this_week')
      ]
    }
  }
]

export function getSummaryReportTemplate(id: string | null | undefined): SummaryReportTemplate | null {
  if (!id) return null
  return SUMMARY_REPORT_TEMPLATES.find((t) => t.id === id) ?? null
}

export function cloneReportConfig(config: SummaryReportConfig): SummaryReportConfig {
  return JSON.parse(JSON.stringify(config)) as SummaryReportConfig
}

export function applySummaryReportTemplate(templateId: string): SummaryReportConfig {
  const template = getSummaryReportTemplate(templateId)
  if (!template) {
    return cloneReportConfig(DEFAULT_REPORT_CONFIG)
  }
  return cloneReportConfig(template.config)
}

export function normalizeReportConfig(raw: unknown): SummaryReportConfig {
  if (!raw || typeof raw !== 'object') {
    return cloneReportConfig(DEFAULT_REPORT_CONFIG)
  }
  const input = raw as Partial<SummaryReportConfig>
  const sections = Array.isArray(input.sections)
    ? input.sections
        .map((item, index) => normalizeSection(item, index))
        .filter((item): item is SummaryReportSection => item !== null)
    : []

  if (!sections.length) {
    return cloneReportConfig(DEFAULT_REPORT_CONFIG)
  }

  return {
    templateId: typeof input.templateId === 'string' ? input.templateId : 'custom',
    sections
  }
}

function normalizeSection(raw: unknown, index: number): SummaryReportSection | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SummaryReportSection>
  const taskFilter = item.taskFilter
  const timeScope = item.timeScope
  if (
    taskFilter !== 'completed' &&
    taskFilter !== 'pending' &&
    taskFilter !== 'overdue'
  ) {
    return null
  }
  if (
    timeScope !== 'since_last' &&
    timeScope !== 'today' &&
    timeScope !== 'this_week' &&
    timeScope !== 'this_month' &&
    timeScope !== 'last_7_days' &&
    timeScope !== 'last_30_days'
  ) {
    return null
  }
  return {
    id: typeof item.id === 'string' && item.id ? item.id : `section-${index + 1}`,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '未命名区块',
    taskFilter,
    timeScope,
    enabled: item.enabled !== false
  }
}

export function createReportSection(
  partial: Partial<SummaryReportSection> = {}
): SummaryReportSection {
  const id =
    partial.id ??
    `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return {
    id,
    title: partial.title?.trim() || '新区块',
    taskFilter: partial.taskFilter ?? 'completed',
    timeScope: partial.timeScope ?? 'this_week',
    enabled: partial.enabled !== false
  }
}

export interface ResolvedTimeBounds {
  from: string
  to: string
  label: string
}

/** 解析区块时间范围；since_last 与发送周期联动 */
export function resolveSectionTimeBounds(
  timeScope: SummaryTimeScope,
  scheduleType: SummaryScheduleType,
  now: dayjs.Dayjs,
  lastSentAt: string | null
): ResolvedTimeBounds {
  const to = now.format('YYYY-MM-DDTHH:mm:ss')

  if (timeScope === 'since_last') {
    const bounds = summaryPeriodBounds(scheduleType, now, lastSentAt)
    return {
      from: bounds.from,
      to: bounds.to,
      label: SUMMARY_TIME_SCOPE_LABELS.since_last
    }
  }

  switch (timeScope) {
    case 'today':
      return {
        from: now.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.today
      }
    case 'this_week':
      return {
        from: startOfWeekMonday(now).format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_week
      }
    case 'this_month':
      return {
        from: now.startOf('month').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_month
      }
    case 'last_7_days':
      return {
        from: now.subtract(7, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.last_7_days
      }
    case 'last_30_days':
      return {
        from: now.subtract(30, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.last_30_days
      }
    default:
      return {
        from: now.subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.since_last
      }
  }
}

export function describeReportConfig(config: SummaryReportConfig): string {
  const enabled = config.sections.filter((s) => s.enabled)
  if (!enabled.length) return '未配置内容'
  return enabled
    .map((s) => `${s.title}（${SUMMARY_TASK_FILTER_LABELS[s.taskFilter]}·${SUMMARY_TIME_SCOPE_LABELS[s.timeScope]}）`)
    .join('；')
}

export function buildSectionTasksSummaryText(
  section: SummaryReportSection,
  tasks: Task[],
  categoryNames: Map<string, string>,
  bounds: ResolvedTimeBounds
): string {
  const header = `【${section.title}】${bounds.label} · ${SUMMARY_TASK_FILTER_LABELS[section.taskFilter]} · ${tasks.length} 项`
  if (!tasks.length) {
    return `${header}\n暂无相关任务。`
  }

  const byCategory = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = task.categoryId ?? '__none__'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(task)
  }

  const lines: string[] = [header]
  for (const [catKey, list] of byCategory) {
    const label = catKey === '__none__' ? '未分类' : categoryNames.get(catKey) ?? '未分类'
    lines.push(`  · ${label}（${list.length}）`)
    for (const task of list) {
      lines.push(`    - ${formatTaskLine(task, section.taskFilter)}`)
    }
  }
  return lines.join('\n')
}

function formatTaskLine(task: Task, filter: SummaryTaskFilter): string {
  if (filter === 'completed') {
    const done = task.completedAt?.slice(0, 16).replace('T', ' ') ?? ''
    return `${task.title}${done ? `（完成 ${done}）` : ''}`
  }
  const due = task.dueAt?.slice(0, 16).replace('T', ' ') ?? ''
  if (filter === 'overdue') {
    return `${task.title}${due ? `（截止 ${due}）` : ''}`
  }
  return `${task.title}${due ? `（截止 ${due}）` : '（无截止）'}`
}

export function buildReportSummaryText(
  sections: Array<{ section: SummaryReportSection; bounds: ResolvedTimeBounds; tasks: Task[] }>,
  categoryNames: Map<string, string>
): string {
  const enabled = sections.filter((item) => item.section.enabled)
  if (!enabled.length) {
    return '未启用任何汇总区块。'
  }

  const parts = enabled.map(({ section, bounds, tasks }) =>
    buildSectionTasksSummaryText(section, tasks, categoryNames, bounds)
  )
  const hasTasks = enabled.some((item) => item.tasks.length > 0)
  if (!hasTasks) {
    return parts.join('\n\n') + '\n\n本周期暂无相关任务。'
  }
  return parts.join('\n\n')
}

/** 本周范围标签（供 UI 展示） */
export function formatWeekRangeLabel(now = dayjs()): string {
  const start = startOfWeekMonday(now)
  const end = endOfWeekSunday(now)
  return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`
}

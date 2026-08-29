import dayjs from 'dayjs'
import type { Task } from './types'
import type { SummaryScheduleType } from './scheduled-summary'
import { summaryPeriodBounds } from './scheduled-summary'
import { endOfWeekSunday, startOfWeekMonday } from './smart-list'
import { layoutSummaryTaskTree, summaryTreeIndent } from './summary-task-tree'

/** 区块统计的任务范围（V1 / V2 status） */
export type SummaryTaskFilter = 'completed' | 'pending' | 'overdue'

/** 区块统计的时间范围 preset */
export type SummaryTimeScope =
  | 'since_last'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'

/** @deprecated 旧版区块结构；新代码请用 SummaryReportSectionV2 */
export interface SummaryReportSectionV1 {
  id: string
  title: string
  taskFilter: SummaryTaskFilter
  timeScope: SummaryTimeScope
  enabled: boolean
}

export type SummaryListScopeMode = 'all' | 'only_list'
export type SummaryDueScope = 'due_today_only'
export type SummaryGroupBy = 'none' | 'category' | 'list'
export type SummaryEmptyGroups = 'hide' | 'show'
export type SummarySortField = 'dueAt' | 'createdAt' | 'completedAt'
export type SummarySortOrder = 'asc' | 'desc'
export type SummaryListStyle = 'bullets' | 'numbered'

export interface SummarySectionQuery {
  status: SummaryTaskFilter
  listScope: {
    mode: SummaryListScopeMode
    listId?: string
  }
  dueScope?: SummaryDueScope | null
}

export interface SummarySectionTime {
  mode: 'preset'
  preset: SummaryTimeScope
}

export interface SummarySectionGroup {
  by: SummaryGroupBy
  emptyGroups: SummaryEmptyGroups
}

export interface SummarySectionSort {
  field: SummarySortField
  order: SummarySortOrder
}

export interface SummarySectionRender {
  style: SummaryListStyle
  showCount: boolean
  showDueAt: boolean
  showCompletedAt: boolean
  limit?: number | null
  hideEmptySection: boolean
}

export interface SummaryReportSectionV2 {
  id: string
  title: string
  enabled: boolean
  query: SummarySectionQuery
  time: SummarySectionTime
  group: SummarySectionGroup
  sort: SummarySectionSort
  render: SummarySectionRender
}

/** 统一对外类型：存取均为 V2 */
export type SummaryReportSection = SummaryReportSectionV2

export type SummaryReportMode = 'form' | 'template'

export interface SummaryFreeTemplate {
  body: string
  syntaxVersion: 1
}

export interface SummaryReportConfig {
  mode: SummaryReportMode
  templateId: string | null
  sections: SummaryReportSectionV2[]
  freeTemplate: SummaryFreeTemplate
}

/** @deprecated 使用 SummaryReportConfig */
export type SummaryReportConfigV2 = SummaryReportConfig

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
  yesterday: '昨天',
  this_week: '本周',
  last_week: '上周',
  this_month: '本月',
  last_month: '上月',
  last_7_days: '最近 7 天',
  last_30_days: '最近 30 天'
}

export const SUMMARY_GROUP_BY_LABELS: Record<SummaryGroupBy, string> = {
  none: '不分组',
  category: '按清单/分类',
  list: '按清单'
}

export const SUMMARY_LIST_STYLE_LABELS: Record<SummaryListStyle, string> = {
  bullets: '项目符号',
  numbered: '编号列表'
}

function defaultRenderForStatus(status: SummaryTaskFilter): SummarySectionRender {
  return {
    style: 'bullets',
    showCount: true,
    showDueAt: status !== 'completed',
    showCompletedAt: status === 'completed',
    limit: null,
    hideEmptySection: false
  }
}

function defaultGroup(): SummarySectionGroup {
  return { by: 'category', emptyGroups: 'hide' }
}

function defaultSort(status: SummaryTaskFilter): SummarySectionSort {
  if (status === 'completed') {
    return { field: 'completedAt', order: 'desc' }
  }
  return { field: 'dueAt', order: 'asc' }
}

export function createReportSectionV2(
  partial: Partial<SummaryReportSectionV2> & {
    taskFilter?: SummaryTaskFilter
    timeScope?: SummaryTimeScope
  } = {}
): SummaryReportSectionV2 {
  const id =
    partial.id ??
    `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const status = partial.query?.status ?? partial.taskFilter ?? 'completed'
  const preset = partial.time?.preset ?? partial.timeScope ?? 'this_week'
  return {
    id,
    title: partial.title?.trim() || '新区块',
    enabled: partial.enabled !== false,
    query: {
      status,
      listScope: partial.query?.listScope ?? { mode: 'all' },
      dueScope: partial.query?.dueScope ?? null
    },
    time: {
      mode: 'preset',
      preset
    },
    group: partial.group ?? defaultGroup(),
    sort: partial.sort ?? defaultSort(status),
    render: partial.render ?? defaultRenderForStatus(status)
  }
}

/** @deprecated 使用 createReportSectionV2 */
export function createReportSection(
  partial: Partial<SummaryReportSectionV1> = {}
): SummaryReportSectionV2 {
  return createReportSectionV2({
    id: partial.id,
    title: partial.title,
    enabled: partial.enabled,
    taskFilter: partial.taskFilter,
    timeScope: partial.timeScope
  })
}

function sectionV2(
  id: string,
  title: string,
  status: SummaryTaskFilter,
  preset: SummaryTimeScope
): SummaryReportSectionV2 {
  return createReportSectionV2({ id, title, taskFilter: status, timeScope: preset })
}

export const DEFAULT_FREE_TEMPLATE_BODY = `{{!-- 自由模板示例：可按需修改 --}}
{{#section status="completed" time="since_last" title="已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}{{#if completedAt}}（完成 {{completedAt}}）{{/if}}
{{/tasks}}
{{/section}}
`

export function createDefaultFreeTemplate(body?: string): SummaryFreeTemplate {
  const text = typeof body === 'string' ? body : ''
  return {
    body: text.length > 0 ? text : DEFAULT_FREE_TEMPLATE_BODY,
    syntaxVersion: 1
  }
}

export const DEFAULT_REPORT_CONFIG: SummaryReportConfig = {
  mode: 'form',
  templateId: 'daily_completed',
  sections: [sectionV2('completed_since_last', '已完成', 'completed', 'since_last')],
  freeTemplate: createDefaultFreeTemplate()
}

function withFormConfig(
  templateId: string,
  sections: SummaryReportSectionV2[]
): SummaryReportConfig {
  return {
    mode: 'form',
    templateId,
    sections,
    freeTemplate: createDefaultFreeTemplate()
  }
}

export const SUMMARY_REPORT_TEMPLATES: SummaryReportTemplate[] = [
  {
    id: 'daily_completed',
    name: '每日已完成回顾',
    description: '汇总自上次发送以来已完成的任务',
    config: withFormConfig('daily_completed', [
      sectionV2('completed_since_last', '已完成', 'completed', 'since_last')
    ])
  },
  {
    id: 'weekly_completed',
    name: '本周已完成',
    description: '汇总本周内完成的任务',
    config: withFormConfig('weekly_completed', [
      sectionV2('completed_week', '本周已完成', 'completed', 'this_week')
    ])
  },
  {
    id: 'weekly_pending',
    name: '本周未完成',
    description: '汇总本周内待办与进行中的任务',
    config: withFormConfig('weekly_pending', [
      sectionV2('pending_week', '本周未完成', 'pending', 'this_week')
    ])
  },
  {
    id: 'weekly_overview',
    name: '本周工作全景',
    description: '同时包含本周已完成、未完成与当前逾期',
    config: withFormConfig('weekly_overview', [
      sectionV2('completed_week', '本周已完成', 'completed', 'this_week'),
      sectionV2('pending_week', '本周未完成', 'pending', 'this_week'),
      sectionV2('overdue_now', '已逾期', 'overdue', 'today')
    ])
  },
  {
    id: 'monthly_completed',
    name: '本月已完成',
    description: '汇总本月内完成的任务',
    config: withFormConfig('monthly_completed', [
      sectionV2('completed_month', '本月已完成', 'completed', 'this_month')
    ])
  },
  {
    id: 'custom',
    name: '自定义',
    description: '自行勾选区块并配置统计范围',
    config: withFormConfig('custom', [
      sectionV2('completed_since_last', '已完成', 'completed', 'since_last'),
      sectionV2('pending_week', '未完成', 'pending', 'this_week')
    ])
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
  // 应用预设模板时保留独立 freeTemplate（默认示例），mode 回到 form
  return cloneReportConfig({
    ...template.config,
    mode: 'form',
    freeTemplate: createDefaultFreeTemplate(template.config.freeTemplate?.body)
  })
}

function isTimeScope(value: unknown): value is SummaryTimeScope {
  return (
    value === 'since_last' ||
    value === 'today' ||
    value === 'yesterday' ||
    value === 'this_week' ||
    value === 'last_week' ||
    value === 'this_month' ||
    value === 'last_month' ||
    value === 'last_7_days' ||
    value === 'last_30_days'
  )
}

function isTaskFilter(value: unknown): value is SummaryTaskFilter {
  return value === 'completed' || value === 'pending' || value === 'overdue'
}

function mapLegacySectionToV2(raw: unknown, index: number): SummaryReportSectionV2 | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SummaryReportSectionV1>
  if (!isTaskFilter(item.taskFilter) || !isTimeScope(item.timeScope)) return null
  return createReportSectionV2({
    id: typeof item.id === 'string' && item.id ? item.id : `section-${index + 1}`,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '未命名区块',
    enabled: item.enabled !== false,
    taskFilter: item.taskFilter,
    timeScope: item.timeScope
  })
}

function normalizeListScope(raw: unknown): SummarySectionQuery['listScope'] {
  if (!raw || typeof raw !== 'object') return { mode: 'all' }
  const item = raw as { mode?: unknown; listId?: unknown }
  if (item.mode === 'only_list' && typeof item.listId === 'string' && item.listId.trim()) {
    return { mode: 'only_list', listId: item.listId.trim() }
  }
  return { mode: 'all' }
}

function normalizeSectionV2(raw: unknown, index: number): SummaryReportSectionV2 | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  // V1 形状：有 taskFilter/timeScope，没有 query
  if (
    (item.taskFilter != null || item.timeScope != null) &&
    (item.query == null || typeof item.query !== 'object')
  ) {
    return mapLegacySectionToV2(item, index)
  }

  const queryRaw = (item.query ?? {}) as Partial<SummarySectionQuery>
  const status = isTaskFilter(queryRaw.status)
    ? queryRaw.status
    : isTaskFilter(item.taskFilter)
      ? item.taskFilter
      : null
  if (!status) return null

  const timeRaw = (item.time ?? {}) as Partial<SummarySectionTime>
  const preset = isTimeScope(timeRaw.preset)
    ? timeRaw.preset
    : isTimeScope(item.timeScope)
      ? item.timeScope
      : 'this_week'

  const groupRaw = (item.group ?? {}) as Partial<SummarySectionGroup>
  const by: SummaryGroupBy =
    groupRaw.by === 'none' || groupRaw.by === 'list' || groupRaw.by === 'category'
      ? groupRaw.by
      : 'category'
  const emptyGroups: SummaryEmptyGroups = groupRaw.emptyGroups === 'show' ? 'show' : 'hide'

  const sortRaw = (item.sort ?? {}) as Partial<SummarySectionSort>
  const field: SummarySortField =
    sortRaw.field === 'createdAt' || sortRaw.field === 'completedAt' || sortRaw.field === 'dueAt'
      ? sortRaw.field
      : defaultSort(status).field
  const order: SummarySortOrder = sortRaw.order === 'desc' ? 'desc' : 'asc'

  const renderRaw = (item.render ?? {}) as Partial<SummarySectionRender>
  const baseRender = defaultRenderForStatus(status)
  const limit =
    typeof renderRaw.limit === 'number' && Number.isFinite(renderRaw.limit) && renderRaw.limit > 0
      ? Math.floor(renderRaw.limit)
      : null

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `section-${index + 1}`,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '未命名区块',
    enabled: item.enabled !== false,
    query: {
      status,
      listScope: normalizeListScope(queryRaw.listScope),
      dueScope: queryRaw.dueScope === 'due_today_only' ? 'due_today_only' : null
    },
    time: { mode: 'preset', preset },
    group: { by, emptyGroups },
    sort: { field, order },
    render: {
      style: renderRaw.style === 'numbered' ? 'numbered' : 'bullets',
      showCount: renderRaw.showCount !== false && (renderRaw.showCount ?? baseRender.showCount),
      showDueAt: renderRaw.showDueAt ?? baseRender.showDueAt,
      showCompletedAt: renderRaw.showCompletedAt ?? baseRender.showCompletedAt,
      limit,
      hideEmptySection: renderRaw.hideEmptySection === true
    }
  }
}

/** 兼容旧版与 V2：统一输出含 mode/freeTemplate 的配置 */
export function normalizeReportConfigV2(raw: unknown): SummaryReportConfig {
  if (!raw || typeof raw !== 'object') {
    return cloneReportConfig(DEFAULT_REPORT_CONFIG)
  }
  const input = raw as Partial<SummaryReportConfig> & {
    freeTemplate?: Partial<SummaryFreeTemplate> | string
  }
  const sections = Array.isArray(input.sections)
    ? input.sections
        .map((item, index) => normalizeSectionV2(item, index))
        .filter((item): item is SummaryReportSectionV2 => item !== null)
    : []

  if (!sections.length) {
    const fallback = cloneReportConfig(DEFAULT_REPORT_CONFIG)
    fallback.mode = input.mode === 'template' ? 'template' : 'form'
    fallback.freeTemplate = normalizeFreeTemplate(input.freeTemplate)
    fallback.templateId = typeof input.templateId === 'string' ? input.templateId : fallback.templateId
    return fallback
  }

  return {
    mode: input.mode === 'template' ? 'template' : 'form',
    templateId: typeof input.templateId === 'string' ? input.templateId : 'custom',
    sections,
    freeTemplate: normalizeFreeTemplate(input.freeTemplate)
  }
}

function normalizeFreeTemplate(raw: unknown): SummaryFreeTemplate {
  if (typeof raw === 'string') {
    return createDefaultFreeTemplate(raw)
  }
  if (raw && typeof raw === 'object') {
    const body = typeof (raw as SummaryFreeTemplate).body === 'string' ? (raw as SummaryFreeTemplate).body : ''
    // 已有 body（含空字符串）保留；仅 undefined/缺失时填示例
    if ('body' in (raw as object)) {
      return { body, syntaxVersion: 1 }
    }
  }
  return createDefaultFreeTemplate()
}

/** 兼容入口：统一走 V2 normalize */
export function normalizeReportConfig(raw: unknown): SummaryReportConfig {
  return normalizeReportConfigV2(raw)
}

export interface ResolvedTimeBounds {
  from: string
  to: string
  label: string
}

/** 本地「今天」日界限（含起止）：00:00:00 ~ 23:59:59 */
export function localDayBounds(now: dayjs.Dayjs = dayjs()): { from: string; to: string } {
  return {
    from: now.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
    to: now.endOf('day').format('YYYY-MM-DDTHH:mm:ss')
  }
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
    case 'yesterday': {
      const y = now.subtract(1, 'day')
      return {
        from: y.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        to: y.endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        label: SUMMARY_TIME_SCOPE_LABELS.yesterday
      }
    }
    case 'this_week':
      return {
        from: startOfWeekMonday(now).format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_week
      }
    case 'last_week': {
      const lastMon = startOfWeekMonday(now).subtract(7, 'day')
      return {
        from: lastMon.format('YYYY-MM-DDTHH:mm:ss'),
        to: lastMon.add(6, 'day').endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        label: SUMMARY_TIME_SCOPE_LABELS.last_week
      }
    }
    case 'this_month':
      return {
        from: now.startOf('month').format('YYYY-MM-DDTHH:mm:ss'),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_month
      }
    case 'last_month': {
      const prev = now.subtract(1, 'month')
      return {
        from: prev.startOf('month').format('YYYY-MM-DDTHH:mm:ss'),
        to: prev.endOf('month').format('YYYY-MM-DDTHH:mm:ss'),
        label: SUMMARY_TIME_SCOPE_LABELS.last_month
      }
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

export function resolveSectionCategoryIds(
  section: SummaryReportSectionV2,
  summaryCategoryIds: string[]
): string[] | undefined {
  if (section.query.listScope.mode === 'only_list' && section.query.listScope.listId) {
    return [section.query.listScope.listId]
  }
  return summaryCategoryIds.length > 0 ? summaryCategoryIds : undefined
}

export function describeReportConfig(config: SummaryReportConfig): string {
  const normalized = normalizeReportConfigV2(config)
  const enabled = normalized.sections.filter((s) => s.enabled)
  if (!enabled.length) return '未配置内容'
  return enabled
    .map((s) => {
      const extras: string[] = []
      if (s.query.dueScope === 'due_today_only') extras.push('今天到期')
      if (s.query.listScope.mode === 'only_list') extras.push('指定清单')
      const extra = extras.length ? `·${extras.join('·')}` : ''
      return `${s.title}（${SUMMARY_TASK_FILTER_LABELS[s.query.status]}·${SUMMARY_TIME_SCOPE_LABELS[s.time.preset]}${extra}）`
    })
    .join('；')
}

function compareNullableIso(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

export function sortSectionTasks(tasks: Task[], sort: SummarySectionSort): Task[] {
  const sorted = [...tasks]
  sorted.sort((a, b) => {
    let cmp = 0
    if (sort.field === 'dueAt') cmp = compareNullableIso(a.dueAt, b.dueAt)
    else if (sort.field === 'createdAt') cmp = compareNullableIso(a.createdAt, b.createdAt)
    else cmp = compareNullableIso(a.completedAt, b.completedAt)
    return sort.order === 'desc' ? -cmp : cmp
  })
  return sorted
}

function formatTaskLineV2(task: Task, render: SummarySectionRender): string {
  const parts: string[] = [task.title]
  if (render.showCompletedAt && task.completedAt) {
    parts.push(`（完成 ${task.completedAt.slice(0, 16).replace('T', ' ')}）`)
  } else if (render.showDueAt) {
    if (task.dueAt) {
      parts.push(`（截止 ${task.dueAt.slice(0, 16).replace('T', ' ')}）`)
    } else {
      parts.push('（无截止）')
    }
  }
  return parts.join('')
}

function bulletPrefix(style: SummaryListStyle, index: number): string {
  return style === 'numbered' ? `${index}.` : '-'
}

export function buildSectionTasksSummaryText(
  section: SummaryReportSectionV2,
  tasks: Task[],
  categoryNames: Map<string, string>,
  bounds: ResolvedTimeBounds,
  /**
   * 用于补齐“未命中父任务”的锚点信息。
   * 只有父子结构需要时才会被调用；如果不传，默认不补齐。
   */
  resolveById: (id: string) => Task | null = () => null
): string | null {
  const sorted = sortSectionTasks(tasks, section.sort)
  const limit =
    section.render.limit != null && section.render.limit > 0 ? section.render.limit : null

  if (!sorted.length && section.render.hideEmptySection) {
    return null
  }

  /**
   * 分组含义：
   * - group.by === 'none'：不按分类/清单分桶，直接在同一层展示树；
   * - group.by === 'category' | 'list'：先按 matched 任务分桶（不含锚点），再在每个桶内树形排布；
   *   对于父锚点：会被注入到“包含其命中子任务的桶”里，避免父任务落空导致阅读断裂。
   */
  const groupBy = section.group.by
  const lines: string[] = []

  /**
   * 把 layoutSummaryTaskTree 的行序列渲染为最终文案行。
   *
   * matched=true 的行：
   * - 使用 formatTaskLineV2，保留完成时间/截止等“命中后缀”。
   *
   * matched=false 的行（祖先锚点）：
   * - 只输出标题 task.title，不带后缀，避免将“父任务未命中”误读为命中结果。
   */
  const pushRows = (rows: ReturnType<typeof layoutSummaryTaskTree>['rows'], basePad: string) => {
    rows.forEach((row, index) => {
      const indent = `${basePad}${summaryTreeIndent(row.depth)}`
      const prefix = bulletPrefix(section.render.style, index + 1)
      if (row.matched) {
        lines.push(`${indent}${prefix} ${formatTaskLineV2(row.task, section.render)}`)
      } else {
        lines.push(`${indent}${prefix} ${row.task.title}`)
      }
    })
  }

  if (groupBy === 'none') {
    // count / limit 的统计口径只基于 matched（命中集合），layoutSummaryTaskTree 内部已处理“锚点不占名额”。
    const { rows, matchedCount } = layoutSummaryTaskTree(sorted, { limit, resolveById })
    const countPart = section.render.showCount ? ` · ${matchedCount} 项` : ''
    const header = `【${section.title}】${bounds.label} · ${SUMMARY_TASK_FILTER_LABELS[section.query.status]}${countPart}`
    if (!matchedCount) {
      if (section.render.hideEmptySection) return null
      return `${header}\n暂无相关任务。`
    }
    lines.push(header)
    pushRows(rows, '  ')
    return lines.join('\n')
  }

  // 先按排序后的 matched 任务截断 limit，再按分类/清单分桶；分桶后组内树形排布。
  const limited =
    limit != null ? sorted.slice(0, limit) : sorted
  const matchedCount = limited.length
  const countPart = section.render.showCount ? ` · ${matchedCount} 项` : ''
  const header = `【${section.title}】${bounds.label} · ${SUMMARY_TASK_FILTER_LABELS[section.query.status]}${countPart}`
  if (!matchedCount) {
    if (section.render.hideEmptySection) return null
    return `${header}\n暂无相关任务。`
  }

  lines.push(header)
  const byCategory = new Map<string, Task[]>()
  for (const task of limited) {
    const key = task.categoryId ?? '__none__'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(task)
  }

  for (const [catKey, list] of byCategory) {
    if (!list.length && section.group.emptyGroups === 'hide') continue
    const label = catKey === '__none__' ? '未分类' : categoryNames.get(catKey) ?? '未分类'
    const countLabel = section.render.showCount ? `（${list.length}）` : ''
    lines.push(`  · ${label}${countLabel}`)
    const { rows } = layoutSummaryTaskTree(list, { resolveById })
    pushRows(rows, '    ')
  }
  return lines.join('\n')
}

export function buildReportSummaryText(
  sections: Array<{ section: SummaryReportSectionV2; bounds: ResolvedTimeBounds; tasks: Task[] }>,
  categoryNames: Map<string, string>,
  resolveById: (id: string) => Task | null = () => null
): string {
  const enabled = sections.filter((item) => item.section.enabled)
  if (!enabled.length) {
    return '未启用任何汇总区块。'
  }

  const parts = enabled
    .map(({ section, bounds, tasks }) =>
      buildSectionTasksSummaryText(section, tasks, categoryNames, bounds, resolveById)
    )
    .filter((part): part is string => part != null)

  if (!parts.length) {
    return '本周期暂无相关任务。'
  }

  const hasTasks = enabled.some((item) => item.tasks.length > 0)
  if (!hasTasks && parts.every((p) => p.includes('暂无相关任务'))) {
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

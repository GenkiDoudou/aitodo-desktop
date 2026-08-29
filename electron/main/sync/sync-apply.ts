import type Database from 'better-sqlite3'
import type { SyncPullChange, SyncEntityType } from '@shared/sync-protocol'
import type { AppMessage, AppMessageKind, Category, Task, TaskView } from '@shared/types'
import type { WidgetNote, WidgetNoteColor } from '@shared/widget-notes'
import { WIDGET_NOTE_COLORS } from '@shared/widget-notes'
import { CategoryRepository } from '../db/category-repository'
import { TaskRepository } from '../db/task-repository'
import { TagRepository } from '../db/tag-repository'
import { TaskReminderRepository } from '../db/task-reminder-repository'
import { WidgetNoteRepository } from '../db/widget-note-repository'
import { TaskViewRepository } from '../db/task-view-repository'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { AppMessageRepository } from '../db/app-message-repository'
import type { TaskReminderInput } from '@shared/task-reminder'
import { applyAppSettingsPayload } from './app-settings-sync'
import { parseFilterAstJson } from '@shared/task-filter-ast'
import type { KanbanBoardMode } from '@shared/kanban-config'
import type { QuadrantLayoutOptions } from '@shared/quadrant-layout'
import type { ScheduledSummary } from '@shared/scheduled-summary'
import { normalizeReportConfigV2 } from '@shared/summary-report-config'

const APPLY_ORDER: SyncEntityType[] = [
  'category',
  'tag',
  'task',
  'task_tag',
  'task_reminder',
  'task_view',
  'scheduled_summary',
  'app_message',
  'app_settings',
  'widget_note'
]

function orderKey(entityType: string): number {
  const i = APPLY_ORDER.indexOf(entityType as SyncEntityType)
  return i >= 0 ? i : 99
}

/** 按依赖顺序排序远程变更 */
export function sortPullChanges(changes: SyncPullChange[]): SyncPullChange[] {
  return [...changes].sort((a, b) => {
    const o = orderKey(a.entityType) - orderKey(b.entityType)
    if (o !== 0) return o
    return a.revision - b.revision
  })
}

export interface ApplyRemoteChangeOpts {
  deviceId: string
  localSyncVersion?: number
  dataDir?: string
  /** 应用远程 UI 偏好后回调（由 SyncEngine 通知渲染进程） */
  onUiPreferencesApplied?: (prefs: Record<string, string>) => void
}

/**
 * 将远程变更应用到本地库。
 * 返回 true 表示写入了本地；false 表示跳过（回声等）。
 */
export function applyRemoteChange(
  db: Database.Database,
  change: SyncPullChange,
  opts: ApplyRemoteChangeOpts
): boolean {
  // Echo / LWW 过滤：
  // - 当 change.originDeviceId === 本机，并且 localSyncVersion >= payload.syncVersion 时，
  //   认为该变更是“本机刚推过的回声”，不重复应用，避免重复 UI 写入。
  // - 各实体 apply 函数内部还会做 updatedAt 的 LWW（服务端胜）。
  if (
    change.originDeviceId &&
    change.originDeviceId === opts.deviceId &&
    opts.localSyncVersion !== undefined &&
    typeof change.payload.syncVersion === 'number' &&
    opts.localSyncVersion >= change.payload.syncVersion
  ) {
    return false
  }

  switch (change.entityType) {
    case 'category':
      applyCategory(db, change)
      return true
    case 'task':
      applyTask(db, change)
      return true
    case 'widget_note':
      applyWidgetNote(db, change)
      return true
    case 'app_settings':
      applyAppSettings(db, change, opts)
      return true
    case 'task_view':
      applyTaskView(db, change)
      return true
    case 'scheduled_summary':
      applyScheduledSummary(db, change)
      return true
    case 'app_message':
      applyAppMessage(db, change)
      return true
    case 'tag':
    case 'task_tag':
    case 'task_reminder':
      // Phase A：标签/提醒内嵌于 task payload，独立类型可忽略或后续扩展
      return false
    default:
      return false
  }
}

function applyAppSettings(
  db: Database.Database,
  change: SyncPullChange,
  opts: ApplyRemoteChangeOpts
): void {
  if (change.operation === 'delete') return
  const uiPrefs = applyAppSettingsPayload(
    change.payload,
    new WidgetNoteRepository(db),
    opts.dataDir
  )
  if (uiPrefs && opts.onUiPreferencesApplied) {
    opts.onUiPreferencesApplied(uiPrefs)
  }
}

function applyTaskView(db: Database.Database, change: SyncPullChange): void {
  const repo = new TaskViewRepository(db)
  const p = change.payload
  const id = String(p.id ?? change.entityId)

  if (change.operation === 'delete') {
    if (repo.findById(id)) {
      repo.delete(id)
    }
    return
  }

  let filterRule = null
  if (p.filterRule != null) {
    if (typeof p.filterRule === 'string') {
      filterRule = parseFilterAstJson(p.filterRule)
    } else if (typeof p.filterRule === 'object') {
      filterRule = p.filterRule as TaskView['filterRule']
    }
  }

  const view: TaskView = {
    id,
    name: String(p.name ?? '未命名视图'),
    layout: (p.layout as TaskView['layout']) ?? 'list',
    scopeKey: (p.scopeKey as string | null) ?? null,
    filterRule,
    groupBy: (p.groupBy as TaskView['groupBy']) ?? 'none',
    sortBy: (p.sortBy as TaskView['sortBy']) ?? 'custom',
    kanbanBoardMode: (p.kanbanBoardMode as KanbanBoardMode | null) ?? null,
    quadrantOptions: (p.quadrantOptions as QuadrantLayoutOptions | null) ?? null,
    sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  }

  const existing = repo.findById(id)
  if (existing && existing.updatedAt > view.updatedAt) {
    return
  }
  if (existing) {
    repo.update(view)
  } else {
    repo.insert(view)
  }
}

function applyScheduledSummary(db: Database.Database, change: SyncPullChange): void {
  const repo = new ScheduledSummaryRepository(db)
  const p = change.payload
  const id = String(p.id ?? change.entityId)

  if (change.operation === 'delete') {
    if (repo.findById(id)) {
      repo.delete(id)
    }
    return
  }

  const summary: ScheduledSummary = {
    id,
    name: String(p.name ?? '汇总'),
    categoryIds: Array.isArray(p.categoryIds) ? (p.categoryIds as string[]) : [],
    scheduleType: (p.scheduleType as ScheduledSummary['scheduleType']) ?? 'daily',
    sendTime: String(p.sendTime ?? '09:00'),
    sendWeekday: typeof p.sendWeekday === 'number' ? p.sendWeekday : null,
    sendDay: typeof p.sendDay === 'number' ? p.sendDay : null,
    useLlm: Boolean(p.useLlm),
    promptText: (p.promptText as string | null) ?? null,
    reportConfig: normalizeReportConfigV2(p.reportConfig),
    enabled: p.enabled !== false,
    lastSentAt: (p.lastSentAt as string | null) ?? null,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  }

  const existing = repo.findById(id)
  if (existing && existing.updatedAt > summary.updatedAt) {
    return
  }
  if (existing) {
    repo.update(summary)
  } else {
    repo.insert(summary)
  }
}

function applyAppMessage(db: Database.Database, change: SyncPullChange): void {
  const repo = new AppMessageRepository(db)
  const p = change.payload
  const id = String(p.id ?? change.entityId)

  if (change.operation === 'delete') {
    repo.deleteById(id)
    return
  }

  const sourceRaw = p.source
  const source =
    sourceRaw === 'task_reminder' || sourceRaw === 'scheduled_summary' ? sourceRaw : null
  // 仅接受定时汇总结果（source=schedule_summary）：
  // 任务提醒等其它通知来源在 Phase A 不做跨端同步，避免把“本机提醒”误当“云结果”同步。
  if (source !== 'scheduled_summary') return

  const kind: AppMessageKind = p.kind === 'activity' ? 'activity' : 'notification'
  const message: AppMessage = {
    id,
    kind,
    title: String(p.title ?? '定时汇总'),
    body: (p.body as string | null) ?? null,
    taskId: (p.taskId as string | null) ?? null,
    source,
    readAt: (p.readAt as string | null) ?? null,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt)
  }

  // readAt 也参与比较：避免多端未读状态在“读/未读”上发生回退。
  const remoteUpdatedAt = String(p.updatedAt ?? p.readAt ?? message.createdAt)
  const existing = repo.findById(id)
  if (existing) {
    const localUpdatedAt = existing.readAt ?? existing.createdAt
    if (localUpdatedAt > remoteUpdatedAt) return
  }
  repo.upsertFromSync(message)
}

function applyCategory(db: Database.Database, change: SyncPullChange): void {
  const repo = new CategoryRepository(db)
  const p = change.payload
  if (change.operation === 'delete') {
    const id = String(p.id ?? change.entityId)
    const ts = String(p.updatedAt ?? p.deletedAt ?? change.serverUpdatedAt)
    if (repo.findById(id)) {
      repo.softDelete(id, ts)
    }
    return
  }

  const category: Category = {
    id: String(p.id ?? change.entityId),
    name: String(p.name ?? '未命名'),
    color: (p.color as string | null) ?? '#409EFF',
    sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0,
    keywords: Array.isArray(p.keywords) ? (p.keywords as string[]) : [],
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt),
    deletedAt: (p.deletedAt as string | null) ?? null
  }
  const existing = repo.findById(category.id)
  if (existing) {
    if (category.deletedAt) {
      repo.softDelete(category.id, category.deletedAt)
    } else {
      repo.update(category.id, {
        name: category.name,
        color: category.color,
        sortOrder: category.sortOrder,
        keywords: category.keywords,
        updatedAt: category.updatedAt
      })
    }
  } else if (!category.deletedAt) {
    repo.insert(category)
  }
}

function applyTask(db: Database.Database, change: SyncPullChange): void {
  const repo = new TaskRepository(db)
  const reminderRepo = new TaskReminderRepository(db)
  const tagRepo = new TagRepository(db)
  const p = change.payload
  const id = String(p.id ?? change.entityId)

  if (change.operation === 'delete') {
    const ts = String(p.updatedAt ?? p.deletedAt ?? change.serverUpdatedAt)
    const syncVersion =
      typeof p.syncVersion === 'number' ? p.syncVersion : (repo.findByIdIncludingDeleted(id)?.syncVersion ?? 0) + 1
    if (repo.findById(id)) {
      repo.softDelete(id, ts, syncVersion)
    }
    return
  }

  const existing = repo.findByIdIncludingDeleted(id)
  const localFired = existing?.remindFiredAt ?? null
  const remoteRemindAt = (p.remindAt as string | null) ?? null
  let remindFiredAt = localFired
  if (existing && remoteRemindAt && existing.remindAt && remoteRemindAt !== existing.remindAt) {
    // remindAt 变更时清空本机已触发状态，避免漏提醒
    remindFiredAt = null
  }

  const task: Task = {
    id,
    title: String(p.title ?? '未命名'),
    description: (p.description as string | null) ?? null,
    status: (p.status as Task['status']) ?? 'TODO',
    priority: (typeof p.priority === 'number' ? p.priority : 4) as Task['priority'],
    categoryId: (p.categoryId as string | null) ?? null,
    parentId: (p.parentId as string | null) ?? null,
    startAt: (p.startAt as string | null) ?? null,
    dueAt: (p.dueAt as string | null) ?? null,
    remindAt: remoteRemindAt,
    remindFiredAt,
    completedAt: (p.completedAt as string | null) ?? null,
    sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt),
    deletedAt: (p.deletedAt as string | null) ?? null,
    syncVersion: typeof p.syncVersion === 'number' ? p.syncVersion : 1,
    kanbanGroupId: (p.kanbanGroupId as string | null) ?? null,
    recurrence: (p.recurrence as Task['recurrence']) ?? null,
    completedOccurrenceDates: Array.isArray(p.completedOccurrenceDates)
      ? (p.completedOccurrenceDates as string[])
      : [],
    remindContinuous: Boolean(p.remindContinuous),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    triagedAt: (p.triagedAt as string | null) ?? null
  }

  if (task.deletedAt) {
    if (existing && !existing.deletedAt) {
      repo.softDelete(id, task.deletedAt, task.syncVersion)
    }
    return
  }

  if (existing) {
    if (existing.deletedAt) {
      repo.restore(id, task.updatedAt)
    }
    repo.update(task)
  } else {
    repo.insert(task)
  }

  if (Array.isArray(p.reminders)) {
    const inputs: TaskReminderInput[] = (p.reminders as Array<{ remindAt: string; offsetMinutes?: number | null }>).map(
      (r) => ({
        remindAt: r.remindAt,
        offsetMinutes: r.offsetMinutes ?? null
      })
    )
    reminderRepo.replaceForTask(id, inputs, task.updatedAt)
  }

  if (Array.isArray(p.tags)) {
    tagRepo.setTaskTags(id, p.tags as string[], task.updatedAt)
  }
}

function applyWidgetNote(db: Database.Database, change: SyncPullChange): void {
  const repo = new WidgetNoteRepository(db)
  const p = change.payload
  const id = String(p.id ?? change.entityId)

  if (change.operation === 'delete') {
    repo.deleteIfExists(id)
    return
  }

  const colorRaw = String(p.color ?? 'yellow')
  const color = WIDGET_NOTE_COLORS.includes(colorRaw as WidgetNoteColor)
    ? (colorRaw as WidgetNoteColor)
    : 'yellow'
  const note: WidgetNote = {
    id,
    content: String(p.content ?? ''),
    color,
    pinned: Boolean(p.pinned),
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  }

  const existing = repo.findNote(id)
  // 全量重放时按 updatedAt：本地更新时不应用旧远程版本
  if (existing && existing.updatedAt > note.updatedAt) {
    return
  }
  repo.upsertFromSync(note)
}

/** 供出站队列序列化 task_view */
export function taskViewToSyncPayload(view: TaskView): Record<string, unknown> {
  return {
    id: view.id,
    name: view.name,
    layout: view.layout,
    scopeKey: view.scopeKey,
    filterRule: view.filterRule,
    groupBy: view.groupBy,
    sortBy: view.sortBy,
    kanbanBoardMode: view.kanbanBoardMode,
    quadrantOptions: view.quadrantOptions,
    sortOrder: view.sortOrder,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt
  }
}

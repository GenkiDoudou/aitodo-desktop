import fs from 'fs'
import { dialog, type BrowserWindow } from 'electron'
import { nowIso } from '@shared/datetime'
import { DEFAULT_TASK_PRIORITY, coerceTaskPriority } from '@shared/task-priority'
import { primaryRemindAt, type TaskReminderInput } from '@shared/task-reminder'
import { normalizeCompletedOccurrenceDates } from '@shared/recurrence-occurrences'
import { normalizeTagNames } from '@shared/task-tags'
import {
  buildTaskDataExport,
  parseTaskDataExport,
  tasksToMarkdown,
  type TaskDataImportResult,
  type TaskExportItem
} from '@shared/task-data-export'
import type { Category, KanbanGroup, Task } from '@shared/types'
import type { TaskRepository } from '../db/task-repository'
import type { CategoryRepository } from '../db/category-repository'
import type { KanbanGroupRepository } from '../db/kanban-group-repository'
import type { TagRepository } from '../db/tag-repository'
import type { TaskReminderRepository } from '../db/task-reminder-repository'
import type { SyncOutbox } from '../db/sync-outbox'

/**
 * 任务数据导入导出：JSON 合并导入、Markdown 只读导出。
 * 与 user-config-service 分离，避免误覆盖个人配置。
 */
export class TaskDataService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly kanbanRepo: KanbanGroupRepository,
    private readonly tagRepo: TagRepository,
    private readonly reminderRepo: TaskReminderRepository,
    private readonly outbox?: SyncOutbox
  ) {}

  private withTx<T>(fn: () => T): T {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn()
  }

  /** 拉取未删除任务并附带标签、提醒 */
  private listExportableTasks(): Task[] {
    const tasks = this.taskRepo.list({ hideDoneScope: 'off', smartList: 'all' })
    if (!tasks.length) return tasks
    const tagMap = this.tagRepo.getTagsByTaskIds(tasks.map((t) => t.id))
    return tasks.map((task) => ({
      ...task,
      tags: tagMap.get(task.id) ?? [],
      reminders: this.reminderRepo.listByTaskId(task.id)
    }))
  }

  private listAllKanbanGroups(): KanbanGroup[] {
    return this.kanbanRepo.listAll()
  }

  buildExportPayload() {
    const categories = this.categoryRepo.list()
    const tasks = this.listExportableTasks()
    const kanbanGroups = this.listAllKanbanGroups()
    return buildTaskDataExport({ tasks, categories, kanbanGroups })
  }

  async exportJsonToFile(parent: BrowserWindow | undefined): Promise<string | null> {
    if (parent && !parent.isDestroyed()) parent.focus()
    const result = await dialog.showSaveDialog(parent ?? undefined, {
      title: '导出任务 JSON',
      defaultPath: `小柒todo-tasks-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    const payload = this.buildExportPayload()
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return result.filePath
  }

  async exportMarkdownToFile(parent: BrowserWindow | undefined): Promise<string | null> {
    if (parent && !parent.isDestroyed()) parent.focus()
    const result = await dialog.showSaveDialog(parent ?? undefined, {
      title: '导出任务 Markdown',
      defaultPath: `小柒todo-tasks-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    })
    if (result.canceled || !result.filePath) return null
    const payload = this.buildExportPayload()
    fs.writeFileSync(result.filePath, tasksToMarkdown(payload.tasks, payload.categories), 'utf-8')
    return result.filePath
  }

  async importJsonFromFile(parent: BrowserWindow | undefined): Promise<TaskDataImportResult | null> {
    if (parent && !parent.isDestroyed()) parent.focus()
    const result = await dialog.showOpenDialog(parent ?? undefined, {
      title: '导入任务 JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const parsed = parseTaskDataExport(raw)
    return this.applyImport(parsed)
  }

  /** 合并导入：按 id upsert 任务与清单，保留导出文件中的时间戳 */
  applyImport(data: ReturnType<typeof buildTaskDataExport>): TaskDataImportResult {
    let importedTasks = 0
    let updatedTasks = 0
    let importedCategories = 0
    const skippedTrash = 0

    return this.withTx(() => {
      const categoryIdByName = new Map<string, string>()
      for (const cat of this.categoryRepo.list()) {
        categoryIdByName.set(cat.name, cat.id)
      }

      for (const item of data.categories ?? []) {
        const existing = this.categoryRepo.findById(item.id)
        const ts = nowIso()
        if (existing) {
          this.categoryRepo.update(item.id, {
            name: item.name,
            color: item.color,
            sortOrder: item.sortOrder,
            keywords: item.keywords ?? [],
            updatedAt: ts
          })
          categoryIdByName.set(item.name, item.id)
        } else {
          const existingNameId = categoryIdByName.get(item.name)
          if (existingNameId) {
            categoryIdByName.set(item.name, existingNameId)
          } else {
            this.categoryRepo.insert({
              id: item.id,
              name: item.name,
              color: item.color,
              sortOrder: item.sortOrder,
              keywords: item.keywords ?? [],
              createdAt: ts,
              updatedAt: ts,
              deletedAt: null
            })
            categoryIdByName.set(item.name, item.id)
            importedCategories += 1
          }
        }
      }

      for (const g of data.kanbanGroups ?? []) {
        if (this.kanbanRepo.findById(g.id)) {
          this.kanbanRepo.update({
            id: g.id,
            scopeKey: g.scopeKey,
            name: g.name,
            sortOrder: g.sortOrder,
            createdAt: nowIso(),
            updatedAt: nowIso()
          })
        } else {
          this.kanbanRepo.insert({
            id: g.id,
            scopeKey: g.scopeKey,
            name: g.name,
            sortOrder: g.sortOrder,
            createdAt: nowIso(),
            updatedAt: nowIso()
          })
        }
      }

      const sorted = sortTasksForImport(data.tasks)
      for (const item of sorted) {
        const categoryId = resolveCategoryId(item, categoryIdByName)
        const existing = this.taskRepo.findById(item.id)
        const task = buildTaskFromExportItem(item, categoryId)

        if (existing) {
          this.taskRepo.update({
            ...task,
            remindFiredAt: existing.remindFiredAt,
            syncVersion: existing.syncVersion + 1,
            deletedAt: null
          })
          updatedTasks += 1
        } else {
          this.taskRepo.insert({ ...task, remindFiredAt: null, syncVersion: 1, deletedAt: null })
          importedTasks += 1
        }

        const tags = normalizeTagNames(item.tags ?? [])
        this.tagRepo.setTaskTags(item.id, tags, nowIso())

        const reminders = normalizeReminders(item)
        this.reminderRepo.replaceForTask(item.id, reminders, nowIso())
      }

      return { importedTasks, updatedTasks, importedCategories, skippedTrash }
    })
  }
}

function sortTasksForImport(tasks: TaskExportItem[]): TaskExportItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const depthCache = new Map<string, number>()

  function depth(id: string, stack = new Set<string>()): number {
    if (depthCache.has(id)) return depthCache.get(id)!
    if (stack.has(id)) return 0
    stack.add(id)
    const task = byId.get(id)
    if (!task?.parentId || !byId.has(task.parentId)) {
      depthCache.set(id, 0)
      return 0
    }
    const d = depth(task.parentId, stack) + 1
    depthCache.set(id, d)
    return d
  }

  return [...tasks].sort((a, b) => depth(a.id) - depth(b.id))
}

function resolveCategoryId(
  item: TaskExportItem,
  categoryIdByName: Map<string, string>
): string | null {
  if (item.categoryName && categoryIdByName.has(item.categoryName)) {
    return categoryIdByName.get(item.categoryName)!
  }
  if (item.categoryId) {
    return item.categoryId
  }
  return null
}

function normalizeReminders(item: TaskExportItem): TaskReminderInput[] {
  if (item.reminders?.length) return item.reminders
  if (item.remindAt) return [{ remindAt: item.remindAt, offsetMinutes: null }]
  return []
}

function buildTaskFromExportItem(item: TaskExportItem, categoryId: string | null): Task {
  const reminders = normalizeReminders(item)
  return {
    id: item.id,
    title: item.title.trim(),
    description: item.description,
    status: item.status,
    priority: coerceTaskPriority(item.priority, DEFAULT_TASK_PRIORITY),
    categoryId,
    parentId: item.parentId,
    startAt: item.startAt,
    dueAt: item.dueAt,
    remindAt: primaryRemindAt(reminders as import('@shared/task-reminder').TaskReminderItem[]) ?? item.remindAt,
    remindFiredAt: null,
    completedAt: item.completedAt,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: null,
    syncVersion: 1,
    kanbanGroupId: item.kanbanGroupId,
    recurrence: item.recurrence ?? null,
    completedOccurrenceDates: normalizeCompletedOccurrenceDates(item.completedOccurrenceDates ?? []),
    remindContinuous: item.remindContinuous ?? false,
    tags: normalizeTagNames(item.tags ?? []),
    triagedAt: item.triagedAt
  }
}

export async function exportTasksJsonToFile(
  service: TaskDataService,
  parent: BrowserWindow | undefined
): Promise<string | null> {
  return service.exportJsonToFile(parent)
}

export async function exportTasksMarkdownToFile(
  service: TaskDataService,
  parent: BrowserWindow | undefined
): Promise<string | null> {
  return service.exportMarkdownToFile(parent)
}

export async function importTasksJsonFromFile(
  service: TaskDataService,
  parent: BrowserWindow | undefined
): Promise<TaskDataImportResult | null> {
  return service.importJsonFromFile(parent)
}

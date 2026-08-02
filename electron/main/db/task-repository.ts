import type Database from 'better-sqlite3'
import type { SummaryTaskFilter } from '@shared/summary-report-config'
import dayjs from 'dayjs'
import { doneTimeRangeBounds, smartListDateBounds } from '@shared/date-filter'
import { dueCutoffIsoForSmartList, isDueSmartList, type DueSmartList } from '@shared/smart-list'
import type { Task, TaskListFilter, TaskStatus } from '@shared/types'
import { parseRecurrenceRule, primaryRemindAt, serializeRecurrenceRule, type TaskReminderItem } from '@shared/task-reminder'
import {
  parseCompletedOccurrenceDates,
  serializeCompletedOccurrenceDates
} from '@shared/recurrence-occurrences'
import { DEFAULT_TASK_PRIORITY, normalizeTaskPriority } from '@shared/task-priority'

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  category_id: string | null
  parent_id: string | null
  start_at: string | null
  due_at: string | null
  remind_at: string | null
  remind_fired_at: string | null
  completed_at: string | null
  priority: number
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  sync_version: number
  kanban_group_id: string | null
  recurrence_rule: string | null
  remind_continuous: number
  completed_occurrence_dates: string | null
  triaged_at: string | null
}

function mapRow(row: TaskRow, reminders: TaskReminderItem[] = []): Task {
  const recurrence = parseRecurrenceRule(row.recurrence_rule)
  const syncedReminders = reminders
  const legacyRemind = primaryRemindAt(syncedReminders) ?? row.remind_at
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: normalizeTaskPriority(row.priority),
    categoryId: row.category_id,
    parentId: row.parent_id,
    startAt: row.start_at ?? null,
    dueAt: row.due_at,
    remindAt: legacyRemind,
    remindFiredAt: row.remind_fired_at,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncVersion: row.sync_version,
    kanbanGroupId: row.kanban_group_id ?? null,
    reminders: syncedReminders,
    recurrence: parseRecurrenceRule(row.recurrence_rule ?? null),
    completedOccurrenceDates: parseCompletedOccurrenceDates(row.completed_occurrence_dates),
    remindContinuous: (row.remind_continuous ?? 0) === 1,
    triagedAt: row.triaged_at ?? null
  }
}

/**
 * better-sqlite3 命名绑定不接受 undefined（会报 Too few parameter values were provided）。
 * IPC/表单合并后偶发 undefined 字段，入库前统一转为 null。
 */
function sqlBind<T extends Record<string, unknown>>(params: T): T {
  const out = { ...params }
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) {
      ;(out as Record<string, unknown>)[key] = null
    }
  }
  return out
}

/** 智能列表 createdAt/completedAt 闭区间（与 shared/date-filter 一致） */
function boundsForSmartListNonDue(smart: DueSmartList) {
  const raw = smartListDateBounds(smart, 'createdAt')
  if (!('from' in raw)) {
    throw new Error('expected closed range for non-due smart list')
  }
  return raw
}

export class TaskRepository {
  constructor(private readonly db: Database.Database) {}

  list(filter: TaskListFilter = {}): Task[] {
    const isTrash = filter.smartList === 'trash'
    const clauses: string[] = isTrash ? ['deleted_at IS NOT NULL'] : ['deleted_at IS NULL']
    const params: Record<string, unknown> = {}

    if (isTrash) {
      if (filter.search?.trim()) {
        clauses.push('LOWER(title) LIKE @search')
        params.search = `%${filter.search.trim().toLowerCase()}%`
      }
      const sql = `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY deleted_at DESC, updated_at DESC`
      const rows = this.db.prepare(sql).all(sqlBind(params)) as TaskRow[]
      return rows.map(mapRow)
    }

    if (filter.hideDone) {
      clauses.push(`status != 'DONE'`)
    }
    if (filter.status) {
      clauses.push('status = @status')
      params.status = filter.status
    }
    if (filter.categoryId !== undefined) {
      if (filter.categoryId === null) {
        // 未分类：仅顶层任务（子任务随父任务在对应清单中展示）
        clauses.push('category_id IS NULL AND parent_id IS NULL')
      } else {
        // 某清单：包含该分类任务及其子任务（子任务 category_id 可能为空但 parent 在清单内）
        clauses.push(`(
          category_id = @categoryId
          OR parent_id IN (
            SELECT id FROM tasks
            WHERE category_id = @categoryId AND deleted_at IS NULL
          )
        )`)
        params.categoryId = filter.categoryId
      }
    }
    if (filter.parentId !== undefined) {
      if (filter.parentId === null) {
        clauses.push('parent_id IS NULL')
      } else {
        clauses.push('parent_id = @parentId')
        params.parentId = filter.parentId
      }
    }
    if (filter.search?.trim()) {
      clauses.push('LOWER(title) LIKE @search')
      params.search = `%${filter.search.trim().toLowerCase()}%`
    }

    if (filter.smartList === 'done') {
      clauses.push(`status = 'DONE'`)
      const doneBounds = doneTimeRangeBounds(filter.doneTimeRange ?? 'all', dayjs(), {
        from: filter.dateFrom,
        to: filter.dateTo
      })
      if (doneBounds) {
        // 无 completed_at 的历史数据用 updated_at 回退，与 completed-task-groups 一致
        clauses.push(
          `COALESCE(completed_at, updated_at) >= @doneFrom AND COALESCE(completed_at, updated_at) <= @doneTo`
        )
        params.doneFrom = doneBounds.from
        params.doneTo = doneBounds.to
      }
    } else if (isDueSmartList(filter.smartList)) {
      const dateField = filter.dateField ?? 'dueAt'
      if (dateField === 'dueAt') {
        clauses.push(`status != 'DONE'`)
        clauses.push(`due_at IS NOT NULL AND due_at <= @dueCutoff`)
        params.dueCutoff = dueCutoffIsoForSmartList(filter.smartList)
      } else if (dateField === 'createdAt') {
        clauses.push(`status != 'DONE'`)
        clauses.push(`created_at >= @smartFrom AND created_at <= @smartTo`)
        const bounds = boundsForSmartListNonDue(filter.smartList)
        params.smartFrom = bounds.from
        params.smartTo = bounds.to
      } else {
        // completedAt：智能列表展示该时段内完成的任务
        clauses.push(`status = 'DONE'`)
        clauses.push(
          `COALESCE(completed_at, updated_at) >= @smartFrom AND COALESCE(completed_at, updated_at) <= @smartTo`
        )
        const bounds = boundsForSmartListNonDue(filter.smartList)
        params.smartFrom = bounds.from
        params.smartTo = bounds.to
      }
    }

    const orderBy =
      filter.smartList === 'done'
        ? 'completed_at DESC, updated_at DESC, sort_order ASC'
        : 'sort_order ASC, created_at DESC'

    const sql = `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`
    const rows = this.db.prepare(sql).all(sqlBind(params)) as TaskRow[]
    return rows.map(mapRow)
  }

  findById(id: string): Task | null {
    if (!id) {
      return null
    }
    const row = this.db
      .prepare(`SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as TaskRow | undefined
    return row ? mapRow(row) : null
  }

  /** 含已软删除记录，供垃圾桶详情与恢复 */
  findByIdIncludingDeleted(id: string): Task | null {
    if (!id) {
      return null
    }
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
    return row ? mapRow(row) : null
  }

  countTrash(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NOT NULL`)
      .get() as { cnt: number }
    return row.cnt
  }

  /** 未删除的已完成任务数（侧栏「有内容时显示」用） */
  countDone(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL AND status = 'DONE'`)
      .get() as { cnt: number }
    return row.cnt
  }

  /** 收件箱未排优：顶层、未完成、未 triaged */
  countInboxUntriaged(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE deleted_at IS NULL
           AND parent_id IS NULL
           AND status != 'DONE'
           AND triaged_at IS NULL`
      )
      .get() as { cnt: number }
    return row.cnt
  }

  findDeletedChildrenByParentId(parentId: string): Task[] {
    const rows = this.db
      .prepare(`SELECT * FROM tasks WHERE parent_id = ? AND deleted_at IS NOT NULL`)
      .all(parentId) as TaskRow[]
    return rows.map(mapRow)
  }

  restore(id: string, updatedAt: string): void {
    this.db
      .prepare(`UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`)
      .run(updatedAt, id)
  }

  /** 恢复前若父任务已不存在，解除 parent 关联（任务仍在垃圾桶中） */
  clearParentOnDeleted(id: string, updatedAt: string): void {
    this.db
      .prepare(
        `UPDATE tasks SET parent_id = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`
      )
      .run(updatedAt, id)
  }

  hardDelete(id: string): void {
    this.db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
  }

  hardDeleteAllTrash(): number {
    const result = this.db.prepare(`DELETE FROM tasks WHERE deleted_at IS NOT NULL`).run()
    return result.changes
  }

  maxSortOrder(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM tasks WHERE deleted_at IS NULL`)
      .get() as { mx: number }
    return row.mx
  }

  insert(task: Task): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, description, status, priority, category_id, parent_id,
          start_at, due_at, remind_at, remind_fired_at, completed_at, sort_order,
          created_at, updated_at, deleted_at, sync_version, kanban_group_id,
          recurrence_rule, remind_continuous, completed_occurrence_dates, triaged_at
        ) VALUES (
          @id, @title, @description, @status, @priority, @categoryId, @parentId,
          @startAt, @dueAt, @remindAt, @remindFiredAt, @completedAt, @sortOrder,
          @createdAt, @updatedAt, NULL, @syncVersion, @kanbanGroupId,
          @recurrenceRule, @remindContinuous, @completedOccurrenceDates, @triagedAt
        )`
      )
      .run(
        sqlBind({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          categoryId: task.categoryId,
          parentId: task.parentId,
          startAt: task.startAt,
          dueAt: task.dueAt,
          remindAt: task.remindAt,
          remindFiredAt: task.remindFiredAt,
          completedAt: task.completedAt,
          sortOrder: task.sortOrder,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          syncVersion: task.syncVersion,
          kanbanGroupId: task.kanbanGroupId,
          recurrenceRule: serializeRecurrenceRule(task.recurrence),
          remindContinuous: task.remindContinuous ? 1 : 0,
          completedOccurrenceDates: serializeCompletedOccurrenceDates(task.completedOccurrenceDates),
          triagedAt: task.triagedAt
        })
      )
  }

  update(task: Task): void {
    this.db
      .prepare(
        `UPDATE tasks SET
          title = @title, description = @description, status = @status,
          priority = @priority, category_id = @categoryId, parent_id = @parentId,
          start_at = @startAt, due_at = @dueAt, remind_at = @remindAt, remind_fired_at = @remindFiredAt,
          completed_at = @completedAt, sort_order = @sortOrder, updated_at = @updatedAt,
          sync_version = @syncVersion,
          kanban_group_id = @kanbanGroupId,
          recurrence_rule = @recurrenceRule, remind_continuous = @remindContinuous,
          completed_occurrence_dates = @completedOccurrenceDates, triaged_at = @triagedAt
         WHERE id = @id AND deleted_at IS NULL`
      )
      .run(
        sqlBind({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          categoryId: task.categoryId,
          parentId: task.parentId,
          startAt: task.startAt,
          dueAt: task.dueAt,
          remindAt: task.remindAt,
          remindFiredAt: task.remindFiredAt,
          completedAt: task.completedAt,
          sortOrder: task.sortOrder,
          updatedAt: task.updatedAt,
          syncVersion: task.syncVersion,
          kanbanGroupId: task.kanbanGroupId,
          recurrenceRule: serializeRecurrenceRule(task.recurrence),
          remindContinuous: task.remindContinuous ? 1 : 0,
          completedOccurrenceDates: serializeCompletedOccurrenceDates(task.completedOccurrenceDates),
          triagedAt: task.triagedAt
        })
      )
  }

  softDelete(id: string, deletedAt: string, syncVersion?: number): void {
    if (syncVersion !== undefined) {
      this.db
        .prepare(
          `UPDATE tasks SET deleted_at = ?, updated_at = ?, sync_version = ? WHERE id = ?`
        )
        .run(deletedAt, deletedAt, syncVersion, id)
      return
    }
    this.db.prepare(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(deletedAt, deletedAt, id)
  }

  countChildren(parentId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE parent_id = ? AND deleted_at IS NULL`
      )
      .get(parentId) as { cnt: number }
    return row.cnt
  }

  /** 直接子任务列表（未删除） */
  findChildrenByParentId(parentId: string): Task[] {
    const rows = this.db
      .prepare(`SELECT * FROM tasks WHERE parent_id = ? AND deleted_at IS NULL`)
      .all(parentId) as TaskRow[]
    return rows.map(mapRow)
  }

  countOpenChildren(parentId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE parent_id = ? AND deleted_at IS NULL AND status != 'DONE'`
      )
      .get(parentId) as { cnt: number }
    return row.cnt
  }

  promoteChildren(parentId: string, updatedAt: string): void {
    this.db
      .prepare(
        `UPDATE tasks SET parent_id = NULL, updated_at = ?
         WHERE parent_id = ? AND deleted_at IS NULL`
      )
      .run(updatedAt, parentId)
  }

  /** 提醒扫描：到期且未触发、未完成、未删除 */
  findDueReminders(nowIso: string): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE deleted_at IS NULL
           AND status != 'DONE'
           AND remind_at IS NOT NULL
           AND remind_at <= ?
           AND remind_fired_at IS NULL`
      )
      .all(nowIso) as TaskRow[]
    return rows.map(mapRow)
  }

  markRemindFired(id: string, firedAt: string): void {
    this.db
      .prepare(`UPDATE tasks SET remind_fired_at = ?, updated_at = ? WHERE id = ?`)
      .run(firedAt, firedAt, id)
  }

  /** 按完成时间区间查询已完成任务（供定时汇总） */
  listCompletedInRange(
    from: string,
    to: string,
    categoryIds?: string[],
    dueBetween?: { from: string; to: string } | null
  ): Task[] {
    const clauses = [
      `deleted_at IS NULL`,
      `status = 'DONE'`,
      `COALESCE(completed_at, updated_at) >= @from`,
      `COALESCE(completed_at, updated_at) < @to`
    ]
    const params: Record<string, unknown> = { from, to }

    if (dueBetween) {
      clauses.push(`due_at IS NOT NULL`, `due_at >= @dueFrom`, `due_at <= @dueTo`)
      params.dueFrom = dueBetween.from
      params.dueTo = dueBetween.to
    }

    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map((_, i) => `@cat${i}`).join(', ')
      clauses.push(`category_id IN (${placeholders})`)
      categoryIds.forEach((id, i) => {
        params[`cat${i}`] = id
      })
    }

    const sql = `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY completed_at DESC, updated_at DESC`
    const rows = this.db.prepare(sql).all(params) as TaskRow[]
    return rows.map(mapRow)
  }

  /** 按区块配置查询任务（供定时汇总） */
  listForSummaryReport(
    filter: SummaryTaskFilter,
    from: string,
    to: string,
    categoryIds?: string[],
    options?: {
      /** 仅 dueAt 落在 [dueFrom, dueTo]（含）的任务；启用后覆盖 pending/overdue 的 due 相对逻辑 */
      dueBetween?: { from: string; to: string } | null
    }
  ): Task[] {
    if (filter === 'completed') {
      return this.listCompletedInRange(from, to, categoryIds, options?.dueBetween)
    }

    const clauses = [`deleted_at IS NULL`, `status != 'DONE'`]
    const params: Record<string, unknown> = { from, to }
    const dueBetween = options?.dueBetween

    if (dueBetween) {
      // 「只看今天到期」：以日历日窗口为准；status 只控制完成态
      clauses.push(`due_at IS NOT NULL`, `due_at >= @dueFrom`, `due_at <= @dueTo`)
      params.dueFrom = dueBetween.from
      params.dueTo = dueBetween.to
      if (filter === 'overdue') {
        clauses.push(`due_at < @to`)
      }
    } else if (filter === 'overdue') {
      clauses.push(`due_at IS NOT NULL`, `due_at < @to`)
    } else {
      clauses.push(`(due_at IS NULL OR due_at >= @to)`)
      clauses.push(`(
        (due_at IS NOT NULL AND due_at >= @from)
        OR (due_at IS NULL AND created_at >= @from AND created_at < @to)
      )`)
    }

    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map((_, i) => `@cat${i}`).join(', ')
      clauses.push(`category_id IN (${placeholders})`)
      categoryIds.forEach((id, i) => {
        params[`cat${i}`] = id
      })
    }

    const orderBy =
      filter === 'overdue'
        ? 'due_at ASC, updated_at DESC'
        : 'CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, created_at DESC, updated_at DESC'

    const sql = `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`
    const rows = this.db.prepare(sql).all(params) as TaskRow[]
    return rows.map(mapRow)
  }
}

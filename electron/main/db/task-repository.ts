import type Database from 'better-sqlite3'
import { todayDatePrefix } from '@shared/datetime'
import type { Task, TaskListFilter, TaskStatus } from '@shared/types'

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  category_id: string | null
  parent_id: string | null
  due_at: string | null
  remind_at: string | null
  remind_fired_at: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  sync_version: number
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    categoryId: row.category_id,
    parentId: row.parent_id,
    dueAt: row.due_at,
    remindAt: row.remind_at,
    remindFiredAt: row.remind_fired_at,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncVersion: row.sync_version
  }
}

export class TaskRepository {
  constructor(private readonly db: Database.Database) {}

  list(filter: TaskListFilter = {}): Task[] {
    const clauses: string[] = ['deleted_at IS NULL']
    const params: Record<string, unknown> = {}

    if (filter.hideDone) {
      clauses.push(`status != 'DONE'`)
    }
    if (filter.status) {
      clauses.push('status = @status')
      params.status = filter.status
    }
    if (filter.categoryId !== undefined) {
      if (filter.categoryId === null) {
        clauses.push('category_id IS NULL')
      } else {
        clauses.push('category_id = @categoryId')
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
    } else if (filter.smartList === 'today') {
      const today = todayDatePrefix()
      const now = `${today}T23:59:59`
      clauses.push(`status != 'DONE'`)
      clauses.push(`due_at IS NOT NULL AND due_at <= @todayEnd`)
      params.todayEnd = now
    }

    const sql = `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC, created_at DESC`
    const rows = this.db.prepare(sql).all(params) as TaskRow[]
    return rows.map(mapRow)
  }

  findById(id: string): Task | null {
    const row = this.db
      .prepare(`SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as TaskRow | undefined
    return row ? mapRow(row) : null
  }

  insert(task: Task): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, description, status, category_id, parent_id,
          due_at, remind_at, remind_fired_at, completed_at, sort_order,
          created_at, updated_at, deleted_at, sync_version
        ) VALUES (
          @id, @title, @description, @status, @categoryId, @parentId,
          @dueAt, @remindAt, @remindFiredAt, @completedAt, @sortOrder,
          @createdAt, @updatedAt, NULL, @syncVersion
        )`
      )
      .run({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        categoryId: task.categoryId,
        parentId: task.parentId,
        dueAt: task.dueAt,
        remindAt: task.remindAt,
        remindFiredAt: task.remindFiredAt,
        completedAt: task.completedAt,
        sortOrder: task.sortOrder,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        syncVersion: task.syncVersion
      })
  }

  update(task: Task): void {
    this.db
      .prepare(
        `UPDATE tasks SET
          title = @title, description = @description, status = @status,
          category_id = @categoryId, parent_id = @parentId,
          due_at = @dueAt, remind_at = @remindAt, remind_fired_at = @remindFiredAt,
          completed_at = @completedAt, sort_order = @sortOrder, updated_at = @updatedAt
         WHERE id = @id AND deleted_at IS NULL`
      )
      .run({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        categoryId: task.categoryId,
        parentId: task.parentId,
        dueAt: task.dueAt,
        remindAt: task.remindAt,
        remindFiredAt: task.remindFiredAt,
        completedAt: task.completedAt,
        sortOrder: task.sortOrder,
        updatedAt: task.updatedAt
      })
  }

  softDelete(id: string, deletedAt: string): void {
    this.db.prepare(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(deletedAt, deletedAt, id)
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
}

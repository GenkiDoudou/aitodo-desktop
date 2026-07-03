import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { remindAtFromDueOffset } from '@shared/task-reminder'
import type { TaskReminderInput, TaskReminderItem } from '@shared/task-reminder'

interface ReminderRow {
  id: string
  task_id: string
  remind_at: string
  fired_at: string | null
  offset_minutes: number | null
  created_at: string
}

function mapRow(row: ReminderRow): TaskReminderItem {
  return {
    id: row.id,
    taskId: row.task_id,
    remindAt: row.remind_at,
    firedAt: row.fired_at,
    offsetMinutes: row.offset_minutes
  }
}

export class TaskReminderRepository {
  constructor(private readonly db: Database.Database) {}

  listByTaskId(taskId: string): TaskReminderItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_reminders WHERE task_id = ? ORDER BY remind_at ASC`
      )
      .all(taskId) as ReminderRow[]
    return rows.map(mapRow)
  }

  listByTaskIds(taskIds: string[]): Map<string, TaskReminderItem[]> {
    const map = new Map<string, TaskReminderItem[]>()
    if (!taskIds.length) return map
    const placeholders = taskIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(`SELECT * FROM task_reminders WHERE task_id IN (${placeholders}) ORDER BY remind_at ASC`)
      .all(...taskIds) as ReminderRow[]
    for (const row of rows) {
      const item = mapRow(row)
      const list = map.get(row.task_id) ?? []
      list.push(item)
      map.set(row.task_id, list)
    }
    return map
  }

  replaceForTask(taskId: string, items: TaskReminderInput[], createdAt: string): TaskReminderItem[] {
    const del = this.db.prepare(`DELETE FROM task_reminders WHERE task_id = ?`)
    const insert = this.db.prepare(
      `INSERT INTO task_reminders (id, task_id, remind_at, fired_at, offset_minutes, created_at)
       VALUES (@id, @taskId, @remindAt, NULL, @offsetMinutes, @createdAt)`
    )
    const tx = this.db.transaction(() => {
      del.run(taskId)
      const result: TaskReminderItem[] = []
      for (const item of items) {
        const id = uuidv4()
        insert.run({
          id,
          taskId,
          remindAt: item.remindAt,
          offsetMinutes: item.offsetMinutes ?? null,
          createdAt
        })
        result.push({
          id,
          taskId,
          remindAt: item.remindAt,
          firedAt: null,
          offsetMinutes: item.offsetMinutes ?? null
        })
      }
      return result
    })
    return tx()
  }

  deleteByTaskId(taskId: string): void {
    this.db.prepare(`DELETE FROM task_reminders WHERE task_id = ?`).run(taskId)
  }

  findDue(nowIso: string): TaskReminderItem[] {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM task_reminders r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE t.deleted_at IS NULL
           AND t.status != 'DONE'
           AND r.remind_at <= ?
           AND r.fired_at IS NULL`
      )
      .all(nowIso) as ReminderRow[]
    return rows.map(mapRow)
  }

  markFired(id: string, firedAt: string): void {
    this.db.prepare(`UPDATE task_reminders SET fired_at = ? WHERE id = ?`).run(firedAt, id)
  }

  clearFiredForTask(taskId: string): void {
    this.db.prepare(`UPDATE task_reminders SET fired_at = NULL WHERE task_id = ?`).run(taskId)
  }

  /** 循环后按偏移重建提醒时间 */
  rebuildOffsetsForTask(taskId: string, newDueAt: string): void {
    const rows = this.db
      .prepare(`SELECT id, offset_minutes FROM task_reminders WHERE task_id = ? AND offset_minutes IS NOT NULL`)
      .all(taskId) as { id: string; offset_minutes: number }[]
    const update = this.db.prepare(`UPDATE task_reminders SET remind_at = ?, fired_at = NULL WHERE id = ?`)
    for (const row of rows) {
      const remindAt = remindAtFromDueOffset(newDueAt, row.offset_minutes)
      update.run(remindAt, row.id)
    }
  }
}

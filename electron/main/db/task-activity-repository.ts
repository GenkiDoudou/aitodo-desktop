import type Database from 'better-sqlite3'
import type { TaskActivity, TaskActivityRetentionPolicy } from '@shared/types'

interface TaskActivityRow {
  id: string
  task_id: string
  type: string
  summary: string
  created_at: string
}

function mapRow(row: TaskActivityRow): TaskActivity {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type as TaskActivity['type'],
    summary: row.summary,
    createdAt: row.created_at
  }
}

export class TaskActivityRepository {
  constructor(private readonly db: Database.Database) {}

  listByTask(taskId: string, limit = 100, before?: string): TaskActivity[] {
    if (before) {
      const rows = this.db
        .prepare(
          `SELECT * FROM task_activities
           WHERE task_id = ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(taskId, before, limit) as TaskActivityRow[]
      return rows.map(mapRow)
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM task_activities
         WHERE task_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(taskId, limit) as TaskActivityRow[]
    return rows.map(mapRow)
  }

  countAll(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM task_activities`).get() as {
      cnt: number
    }
    return row.cnt
  }

  insert(activity: TaskActivity): void {
    this.db
      .prepare(
        `INSERT INTO task_activities (id, task_id, type, summary, created_at)
         VALUES (@id, @taskId, @type, @summary, @createdAt)`
      )
      .run({
        id: activity.id,
        taskId: activity.taskId,
        type: activity.type,
        summary: activity.summary,
        createdAt: activity.createdAt
      })
  }

  insertMany(activities: TaskActivity[]): void {
    if (!activities.length) return
    const stmt = this.db.prepare(
      `INSERT INTO task_activities (id, task_id, type, summary, created_at)
       VALUES (@id, @taskId, @type, @summary, @createdAt)`
    )
    const tx = this.db.transaction((rows: TaskActivity[]) => {
      for (const activity of rows) {
        stmt.run({
          id: activity.id,
          taskId: activity.taskId,
          type: activity.type,
          summary: activity.summary,
          createdAt: activity.createdAt
        })
      }
    })
    tx(activities)
  }

  deleteAll(): number {
    const result = this.db.prepare(`DELETE FROM task_activities`).run()
    return result.changes
  }

  deleteByTaskId(taskId: string): number {
    const result = this.db.prepare(`DELETE FROM task_activities WHERE task_id = ?`).run(taskId)
    return result.changes
  }

  /** 删除仍在垃圾桶中的任务所关联的动态 */
  deleteForTrashedTasks(): number {
    const result = this.db
      .prepare(
        `DELETE FROM task_activities
         WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL)`
      )
      .run()
    return result.changes
  }

  purgeByPolicy(policy: TaskActivityRetentionPolicy): number {
    if (policy.mode === 'forever') {
      return 0
    }
    if (policy.mode === 'max_count' && policy.maxCount) {
      const keep = Math.max(1, policy.maxCount)
      const result = this.db
        .prepare(
          `DELETE FROM task_activities
           WHERE id NOT IN (
             SELECT id FROM task_activities
             ORDER BY created_at DESC
             LIMIT ?
           )`
        )
        .run(keep)
      return result.changes
    }
    if (policy.mode === 'max_days' && policy.maxDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - policy.maxDays)
      const cutoffIso = cutoff.toISOString().slice(0, 19)
      const result = this.db
        .prepare(`DELETE FROM task_activities WHERE created_at < ?`)
        .run(cutoffIso)
      return result.changes
    }
    return 0
  }
}

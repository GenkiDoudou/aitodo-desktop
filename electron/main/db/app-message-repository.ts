import type Database from 'better-sqlite3'
import type { AppMessage, AppMessageKind } from '@shared/types'

interface AppMessageRow {
  id: string
  kind: string
  title: string
  body: string | null
  task_id: string | null
  read_at: string | null
  created_at: string
}

function mapRow(row: AppMessageRow): AppMessage {
  return {
    id: row.id,
    kind: row.kind as AppMessageKind,
    title: row.title,
    body: row.body,
    taskId: row.task_id,
    readAt: row.read_at,
    createdAt: row.created_at
  }
}

export class AppMessageRepository {
  constructor(private readonly db: Database.Database) {}

  list(kind?: AppMessageKind, limit = 100): AppMessage[] {
    if (kind) {
      const rows = this.db
        .prepare(
          `SELECT * FROM app_messages WHERE kind = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(kind, limit) as AppMessageRow[]
      return rows.map(mapRow)
    }
    const rows = this.db
      .prepare(`SELECT * FROM app_messages ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as AppMessageRow[]
    return rows.map(mapRow)
  }

  countUnread(kind?: AppMessageKind): number {
    if (kind) {
      const row = this.db
        .prepare(`SELECT COUNT(*) as cnt FROM app_messages WHERE kind = ? AND read_at IS NULL`)
        .get(kind) as { cnt: number }
      return row.cnt
    }
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM app_messages WHERE read_at IS NULL`)
      .get() as { cnt: number }
    return row.cnt
  }

  findById(id: string): AppMessage | null {
    const row = this.db.prepare(`SELECT * FROM app_messages WHERE id = ?`).get(id) as
      | AppMessageRow
      | undefined
    return row ? mapRow(row) : null
  }

  insert(message: AppMessage): void {
    this.db
      .prepare(
        `INSERT INTO app_messages (id, kind, title, body, task_id, read_at, created_at)
         VALUES (@id, @kind, @title, @body, @taskId, @readAt, @createdAt)`
      )
      .run({
        id: message.id,
        kind: message.kind,
        title: message.title,
        body: message.body,
        taskId: message.taskId,
        readAt: message.readAt,
        createdAt: message.createdAt
      })
  }

  markRead(id: string, readAt: string): void {
    this.db.prepare(`UPDATE app_messages SET read_at = ? WHERE id = ? AND read_at IS NULL`).run(
      readAt,
      id
    )
  }

  markAllRead(kind: AppMessageKind | undefined, readAt: string): number {
    if (kind) {
      const result = this.db
        .prepare(`UPDATE app_messages SET read_at = ? WHERE kind = ? AND read_at IS NULL`)
        .run(readAt, kind)
      return result.changes
    }
    const result = this.db
      .prepare(`UPDATE app_messages SET read_at = ? WHERE read_at IS NULL`)
      .run(readAt)
    return result.changes
  }
}

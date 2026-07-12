import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import { extractTagsFromText, normalizeTagNames } from '@shared/task-tags'

interface TagRow {
  id: string
  name: string
}

export class TagRepository {
  constructor(private readonly db: Database.Database) {}

  listAllNames(): string[] {
    const rows = this.db
      .prepare(`SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC`)
      .all() as { name: string }[]
    return rows.map((r) => r.name)
  }

  getTagsByTaskIds(taskIds: string[]): Map<string, string[]> {
    const map = new Map<string, string[]>()
    if (!taskIds.length) {
      return map
    }
    const placeholders = taskIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT tt.task_id AS taskId, t.name AS name
         FROM task_tags tt
         INNER JOIN tags t ON t.id = tt.tag_id
         WHERE tt.task_id IN (${placeholders})
         ORDER BY t.name COLLATE NOCASE ASC`
      )
      .all(...taskIds) as { taskId: string; name: string }[]

    for (const row of rows) {
      const list = map.get(row.taskId) ?? []
      list.push(row.name)
      map.set(row.taskId, list)
    }
    return map
  }

  getTagsForTask(taskId: string): string[] {
    return this.getTagsByTaskIds([taskId]).get(taskId) ?? []
  }

  /** 覆盖任务的标签关联；自动创建不存在的标签 */
  setTaskTags(taskId: string, tagNames: readonly string[], ts = nowIso()): string[] {
    const normalized = normalizeTagNames(tagNames)
    const deleteLinks = this.db.prepare(`DELETE FROM task_tags WHERE task_id = ?`)
    const findTag = this.db.prepare(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`)
    const insertTag = this.db.prepare(
      `INSERT INTO tags (id, name, created_at) VALUES (@id, @name, @createdAt)`
    )
    const insertLink = this.db.prepare(
      `INSERT INTO task_tags (task_id, tag_id, created_at) VALUES (@taskId, @tagId, @createdAt)`
    )

    const apply = this.db.transaction(() => {
      deleteLinks.run(taskId)
      for (const name of normalized) {
        let row = findTag.get(name) as TagRow | undefined
        if (!row) {
          const id = uuidv4()
          insertTag.run({ id, name, createdAt: ts })
          row = { id, name }
        }
        insertLink.run({ taskId, tagId: row.id, createdAt: ts })
      }
      this.pruneOrphanTags()
    })
    apply()
    return normalized
  }

  private pruneOrphanTags(): void {
    this.db
      .prepare(
        `DELETE FROM tags
         WHERE id NOT IN (SELECT DISTINCT tag_id FROM task_tags)`
      )
      .run()
  }

  deleteLinksForTask(taskId: string): void {
    this.db.prepare(`DELETE FROM task_tags WHERE task_id = ?`).run(taskId)
    this.pruneOrphanTags()
  }
}

/** 将历史 #标签 从标题/正文迁移到 task_tags（仅 v13 升级后执行一次） */
export function migrateLegacyTaskTags(db: Database.Database): void {
  const repo = new TagRepository(db)
  const rows = db
    .prepare(`SELECT id, title, description FROM tasks WHERE deleted_at IS NULL`)
    .all() as { id: string; title: string; description: string | null }[]

  const existingLinks = db.prepare(`SELECT 1 FROM task_tags LIMIT 1`).get()
  if (existingLinks) {
    return
  }

  const ts = nowIso()
  for (const row of rows) {
    const names = extractTagsFromText(row.title, row.description)
    if (names.length) {
      repo.setTaskTags(row.id, names, ts)
    }
  }
}

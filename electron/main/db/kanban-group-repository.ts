import type Database from 'better-sqlite3'
import type { KanbanGroup } from '@shared/types'
import { isKanbanUngroupedMetaId } from '@shared/kanban-scope'

interface KanbanGroupRow {
  id: string
  scope_key: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function mapRow(row: KanbanGroupRow): KanbanGroup {
  return {
    id: row.id,
    scopeKey: row.scope_key,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class KanbanGroupRepository {
  constructor(private readonly db: Database.Database) {}

  listByScope(scopeKey: string): KanbanGroup[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM kanban_groups WHERE scope_key = ? ORDER BY sort_order ASC, created_at ASC`
      )
      .all(scopeKey) as KanbanGroupRow[]
    return rows.map(mapRow)
  }

  findById(id: string): KanbanGroup | null {
    const row = this.db.prepare(`SELECT * FROM kanban_groups WHERE id = ?`).get(id) as
      | KanbanGroupRow
      | undefined
    return row ? mapRow(row) : null
  }

  maxSortOrder(scopeKey: string): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM kanban_groups WHERE scope_key = ?`)
      .get(scopeKey) as { mx: number }
    return row.mx
  }

  insert(group: KanbanGroup): void {
    this.db
      .prepare(
        `INSERT INTO kanban_groups (id, scope_key, name, sort_order, created_at, updated_at)
         VALUES (@id, @scopeKey, @name, @sortOrder, @createdAt, @updatedAt)`
      )
      .run({
        id: group.id,
        scopeKey: group.scopeKey,
        name: group.name,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      })
  }

  update(group: KanbanGroup): void {
    this.db
      .prepare(
        `UPDATE kanban_groups SET name = @name, sort_order = @sortOrder, updated_at = @updatedAt WHERE id = @id`
      )
      .run({
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        updatedAt: group.updatedAt
      })
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM kanban_groups WHERE id = ?`).run(id)
  }

  /** 删除分组后任务归入未分组 */
  clearTasksGroupId(groupId: string): void {
    this.db.prepare(`UPDATE tasks SET kanban_group_id = NULL WHERE kanban_group_id = ?`).run(groupId)
  }

  shiftSortOrders(scopeKey: string, fromOrder: number, delta: number): void {
    const excludeMeta = `AND id NOT LIKE '__ungrouped__:%'`
    if (delta > 0) {
      this.db
        .prepare(
          `UPDATE kanban_groups SET sort_order = sort_order + ?
           WHERE scope_key = ? AND sort_order >= ? ${excludeMeta}`
        )
        .run(delta, scopeKey, fromOrder)
    } else {
      this.db
        .prepare(
          `UPDATE kanban_groups SET sort_order = sort_order + ?
           WHERE scope_key = ? AND sort_order > ? ${excludeMeta}`
        )
        .run(delta, scopeKey, fromOrder)
    }
  }

  /** 仅统计用户自定义列的最大 sort_order（不含未分组元数据行） */
  maxCustomSortOrder(scopeKey: string): number {
    const rows = this.db
      .prepare(`SELECT sort_order FROM kanban_groups WHERE scope_key = ?`)
      .all(scopeKey) as { sort_order: number }[]
    let max = -1
    for (const row of rows) {
      if (row.sort_order > max) max = row.sort_order
    }
    return max
  }

  listCustomByScope(scopeKey: string): KanbanGroup[] {
    return this.listByScope(scopeKey).filter((g) => !isKanbanUngroupedMetaId(g.id))
  }
}

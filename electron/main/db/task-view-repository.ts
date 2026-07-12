import type { TaskView } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { parseFilterAstJson, serializeFilterAst } from '@shared/task-filter-ast'
import type { QuadrantLayoutOptions } from '@shared/quadrant-layout'
import type Database from 'better-sqlite3'

interface TaskViewRow {
  id: string
  name: string
  layout: string
  scope_key: string | null
  filter_rule_json: string | null
  group_by: string
  sort_by: string
  kanban_board_mode: string | null
  quadrant_options_json: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function parseQuadrantOptions(json: string | null): QuadrantLayoutOptions | null {
  if (!json) return null
  try {
    return JSON.parse(json) as QuadrantLayoutOptions
  } catch {
    return null
  }
}

function mapRow(row: TaskViewRow): TaskView {
  return {
    id: row.id,
    name: row.name,
    layout: row.layout as TaskView['layout'],
    scopeKey: row.scope_key,
    filterRule: row.filter_rule_json ? parseFilterAstJson(row.filter_rule_json) : null,
    groupBy: row.group_by as TaskView['groupBy'],
    sortBy: row.sort_by as TaskView['sortBy'],
    kanbanBoardMode: row.kanban_board_mode as KanbanBoardMode | null,
    quadrantOptions: parseQuadrantOptions(row.quadrant_options_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class TaskViewRepository {
  constructor(private readonly db: Database.Database) {}

  list(): TaskView[] {
    const rows = this.db
      .prepare(`SELECT * FROM task_views ORDER BY sort_order ASC, created_at ASC`)
      .all() as TaskViewRow[]
    return rows.map(mapRow)
  }

  findById(id: string): TaskView | null {
    const row = this.db.prepare(`SELECT * FROM task_views WHERE id = ?`).get(id) as
      | TaskViewRow
      | undefined
    return row ? mapRow(row) : null
  }

  findByName(name: string): TaskView | null {
    const row = this.db.prepare(`SELECT * FROM task_views WHERE name = ?`).get(name) as
      | TaskViewRow
      | undefined
    return row ? mapRow(row) : null
  }

  maxSortOrder(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM task_views`)
      .get() as { mx: number }
    return row.mx
  }

  insert(view: TaskView): void {
    this.db
      .prepare(
        `INSERT INTO task_views (
          id, name, layout, scope_key, filter_rule_json, group_by, sort_by,
          kanban_board_mode, quadrant_options_json, sort_order, created_at, updated_at
        ) VALUES (
          @id, @name, @layout, @scopeKey, @filterRuleJson, @groupBy, @sortBy,
          @kanbanBoardMode, @quadrantOptionsJson, @sortOrder, @createdAt, @updatedAt
        )`
      )
      .run({
        id: view.id,
        name: view.name,
        layout: view.layout,
        scopeKey: view.scopeKey,
        filterRuleJson: view.filterRule ? serializeFilterAst(view.filterRule) : null,
        groupBy: view.groupBy,
        sortBy: view.sortBy,
        kanbanBoardMode: view.kanbanBoardMode,
        quadrantOptionsJson: view.quadrantOptions ? JSON.stringify(view.quadrantOptions) : null,
        sortOrder: view.sortOrder,
        createdAt: view.createdAt,
        updatedAt: view.updatedAt
      })
  }

  update(view: TaskView): void {
    this.db
      .prepare(
        `UPDATE task_views SET
          name = @name, layout = @layout, scope_key = @scopeKey,
          filter_rule_json = @filterRuleJson, group_by = @groupBy, sort_by = @sortBy,
          kanban_board_mode = @kanbanBoardMode, quadrant_options_json = @quadrantOptionsJson,
          sort_order = @sortOrder, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: view.id,
        name: view.name,
        layout: view.layout,
        scopeKey: view.scopeKey,
        filterRuleJson: view.filterRule ? serializeFilterAst(view.filterRule) : null,
        groupBy: view.groupBy,
        sortBy: view.sortBy,
        kanbanBoardMode: view.kanbanBoardMode,
        quadrantOptionsJson: view.quadrantOptions ? JSON.stringify(view.quadrantOptions) : null,
        sortOrder: view.sortOrder,
        updatedAt: view.updatedAt
      })
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM task_views WHERE id = ?`).run(id)
  }
}

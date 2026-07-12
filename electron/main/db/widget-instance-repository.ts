import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import type {
  CreateWidgetInstanceDto,
  UpdateWidgetInstanceDto,
  WidgetInstance,
  WidgetKind
} from '@shared/widget-notes'
import {
  WIDGET_DEFAULT_HEIGHT,
  WIDGET_DEFAULT_WIDTH,
  WIDGET_KANBAN_DEFAULT_HEIGHT,
  WIDGET_KANBAN_DEFAULT_WIDTH,
  WIDGET_KINDS
} from '@shared/widget-notes'
import {
  defaultCollapsePolicyForKind,
  defaultDisplayModeForKind,
  sanitizeCollapsePolicy,
  sanitizeDisplayMode,
  sanitizeEdgeAnchor
} from '@shared/widget-display'
import { AppError } from '@shared/types'

interface WidgetInstanceRow {
  id: string
  kind: string
  view_id: string | null
  name: string
  x: number
  y: number
  width: number
  height: number
  always_on_top: number
  sort_order: number
  display_mode: string
  collapse_policy: string
  idle_timeout_sec: number
  edge_anchor: string
  expanded_x: number | null
  expanded_y: number | null
  expanded_width: number | null
  expanded_height: number | null
  created_at: string
  updated_at: string
}

function sanitizeKind(kind: unknown): WidgetKind {
  return WIDGET_KINDS.includes(kind as WidgetKind) ? (kind as WidgetKind) : 'notes'
}

function mapInstance(row: WidgetInstanceRow): WidgetInstance {
  const kind = sanitizeKind(row.kind)
  const fallbackMode = defaultDisplayModeForKind(kind)
  const fallbackPolicy = defaultCollapsePolicyForKind(kind)
  return {
    id: row.id,
    kind,
    viewId: row.view_id,
    name: row.name,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    alwaysOnTop: row.always_on_top === 1,
    sortOrder: row.sort_order,
    displayMode: sanitizeDisplayMode(row.display_mode, fallbackMode),
    collapsePolicy: sanitizeCollapsePolicy(row.collapse_policy, fallbackPolicy),
    idleTimeoutSec: row.idle_timeout_sec > 0 ? row.idle_timeout_sec : 30,
    edgeAnchor: sanitizeEdgeAnchor(row.edge_anchor, 'right'),
    expandedX: row.expanded_x ?? row.x,
    expandedY: row.expanded_y ?? row.y,
    expandedWidth: row.expanded_width ?? row.width,
    expandedHeight: row.expanded_height ?? row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class WidgetInstanceRepository {
  constructor(private readonly db: Database.Database) {}

  list(): WidgetInstance[] {
    const rows = this.db
      .prepare(`SELECT * FROM widget_instances ORDER BY sort_order ASC, created_at ASC`)
      .all() as WidgetInstanceRow[]
    return rows.map(mapInstance)
  }

  find(id: string): WidgetInstance | null {
    const row = this.db.prepare(`SELECT * FROM widget_instances WHERE id = ?`).get(id) as
      | WidgetInstanceRow
      | undefined
    return row ? mapInstance(row) : null
  }

  create(dto: CreateWidgetInstanceDto): WidgetInstance {
    const kind = sanitizeKind(dto.kind)
    if (kind === 'view' && !dto.viewId?.trim()) {
      throw new AppError('VALIDATION_ERROR', '视图挂件必须选择视图')
    }
    if (kind !== 'view' && dto.viewId) {
      throw new AppError('VALIDATION_ERROR', '仅视图挂件可绑定视图')
    }

    const ts = nowIso()
    const id = uuidv4()
    const sortOrder =
      (this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM widget_instances`).get() as {
        next: number
      }).next ?? 0

    const defaults = this.db
      .prepare(`SELECT x, y, width, height, always_on_top FROM widget_settings WHERE id = 'default'`)
      .get() as { x: number; y: number; width: number; height: number; always_on_top: number } | undefined

    const viewId = kind === 'view' ? dto.viewId!.trim() : null
    let width = defaults?.width ?? WIDGET_DEFAULT_WIDTH
    let height = defaults?.height ?? WIDGET_DEFAULT_HEIGHT
    if (kind === 'view' && viewId) {
      const viewRow = this.db
        .prepare(`SELECT layout FROM task_views WHERE id = ?`)
        .get(viewId) as { layout: string } | undefined
      if (viewRow?.layout === 'kanban') {
        width = WIDGET_KANBAN_DEFAULT_WIDTH
        height = WIDGET_KANBAN_DEFAULT_HEIGHT
      }
    }

    const x = defaults?.x ?? 200
    const y = (defaults?.y ?? 200) + sortOrder * 32
    const displayMode = defaultDisplayModeForKind(kind)
    const collapsePolicy = defaultCollapsePolicyForKind(kind)

    const instance: WidgetInstance = {
      id,
      kind,
      viewId,
      name: dto.name?.trim() ?? '',
      x,
      y,
      width,
      height,
      alwaysOnTop: defaults?.always_on_top === 1,
      sortOrder,
      displayMode,
      collapsePolicy,
      idleTimeoutSec: 30,
      edgeAnchor: 'right',
      expandedX: x,
      expandedY: y,
      expandedWidth: width,
      expandedHeight: height,
      createdAt: ts,
      updatedAt: ts
    }

    this.db
      .prepare(
        `INSERT INTO widget_instances (
          id, kind, view_id, name, x, y, width, height, always_on_top, sort_order,
          display_mode, collapse_policy, idle_timeout_sec, edge_anchor,
          expanded_x, expanded_y, expanded_width, expanded_height,
          created_at, updated_at
        ) VALUES (
          @id, @kind, @viewId, @name, @x, @y, @width, @height, @alwaysOnTop, @sortOrder,
          @displayMode, @collapsePolicy, @idleTimeoutSec, @edgeAnchor,
          @expandedX, @expandedY, @expandedWidth, @expandedHeight,
          @createdAt, @updatedAt
        )`
      )
      .run({
        id: instance.id,
        kind: instance.kind,
        viewId: instance.viewId,
        name: instance.name,
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        alwaysOnTop: instance.alwaysOnTop ? 1 : 0,
        sortOrder: instance.sortOrder,
        displayMode: instance.displayMode,
        collapsePolicy: instance.collapsePolicy,
        idleTimeoutSec: instance.idleTimeoutSec,
        edgeAnchor: instance.edgeAnchor,
        expandedX: instance.expandedX,
        expandedY: instance.expandedY,
        expandedWidth: instance.expandedWidth,
        expandedHeight: instance.expandedHeight,
        createdAt: ts,
        updatedAt: ts
      })

    return instance
  }

  update(id: string, dto: UpdateWidgetInstanceDto): WidgetInstance {
    const current = this.find(id)
    if (!current) {
      throw new AppError('NOT_FOUND', '挂件不存在')
    }
    const ts = nowIso()
    const next: WidgetInstance = {
      ...current,
      name: dto.name ?? current.name,
      x: dto.x ?? current.x,
      y: dto.y ?? current.y,
      width: dto.width ?? current.width,
      height: dto.height ?? current.height,
      alwaysOnTop: dto.alwaysOnTop ?? current.alwaysOnTop,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      displayMode: dto.displayMode ?? current.displayMode,
      collapsePolicy: dto.collapsePolicy ?? current.collapsePolicy,
      idleTimeoutSec: dto.idleTimeoutSec ?? current.idleTimeoutSec,
      edgeAnchor: dto.edgeAnchor ?? current.edgeAnchor,
      expandedX: dto.expandedX ?? current.expandedX,
      expandedY: dto.expandedY ?? current.expandedY,
      expandedWidth: dto.expandedWidth ?? current.expandedWidth,
      expandedHeight: dto.expandedHeight ?? current.expandedHeight,
      updatedAt: ts
    }
    this.db
      .prepare(
        `UPDATE widget_instances SET
          name = @name, x = @x, y = @y, width = @width, height = @height,
          always_on_top = @alwaysOnTop, sort_order = @sortOrder,
          display_mode = @displayMode, collapse_policy = @collapsePolicy,
          idle_timeout_sec = @idleTimeoutSec, edge_anchor = @edgeAnchor,
          expanded_x = @expandedX, expanded_y = @expandedY,
          expanded_width = @expandedWidth, expanded_height = @expandedHeight,
          updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        name: next.name,
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
        alwaysOnTop: next.alwaysOnTop ? 1 : 0,
        sortOrder: next.sortOrder,
        displayMode: next.displayMode,
        collapsePolicy: next.collapsePolicy,
        idleTimeoutSec: next.idleTimeoutSec,
        edgeAnchor: next.edgeAnchor,
        expandedX: next.expandedX,
        expandedY: next.expandedY,
        expandedWidth: next.expandedWidth,
        expandedHeight: next.expandedHeight,
        updatedAt: ts
      })
    return next
  }

  delete(id: string): void {
    const result = this.db.prepare(`DELETE FROM widget_instances WHERE id = ?`).run(id)
    if (result.changes === 0) {
      throw new AppError('NOT_FOUND', '挂件不存在')
    }
  }
}

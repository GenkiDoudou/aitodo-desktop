import type Database from 'better-sqlite3'
import { nowIso } from '@shared/datetime'
import type {
  DesktopFenceLayout,
  DesktopFenceSettings,
  UpdateDesktopFenceLayoutDto,
  UpdateDesktopFenceSettingsDto
} from '@shared/fence-types'
import {
  FENCE_LAYOUT_DIMENSION_VERSION,
  FENCE_SLOT_IDS,
  defaultFenceSlotLayout,
  type FenceSlotId,
  type WorkAreaRect
} from '@shared/fence-slot-config'
import { AppError } from '@shared/types'

interface FenceSettingsRow {
  id: string
  fences_enabled: number
  fences_always_on_top: number
  hide_native_icons?: number
  layout_dimension_version?: number
  updated_at: string
}

interface FenceLayoutRow {
  category_id: string
  x: number
  y: number
  width: number
  height: number
  visible: number
  updated_at: string
}

const SETTINGS_ID = 'default'

function mapSettings(row: FenceSettingsRow): DesktopFenceSettings {
  return {
    id: row.id,
    fencesEnabled: row.fences_enabled === 1,
    fencesAlwaysOnTop: row.fences_always_on_top === 1,
    hideNativeIcons: row.hide_native_icons == null ? false : row.hide_native_icons === 1,
    layoutDimensionVersion: row.layout_dimension_version ?? 1,
    updatedAt: row.updated_at
  }
}

function mapLayout(row: FenceLayoutRow): DesktopFenceLayout {
  return {
    categoryId: row.category_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    visible: row.visible === 1,
    updatedAt: row.updated_at
  }
}

export class FenceLayoutRepository {
  constructor(private readonly db: Database.Database) {}

  getSettings(): DesktopFenceSettings {
    const row = this.db
      .prepare(`SELECT * FROM desktop_fence_settings WHERE id = ?`)
      .get(SETTINGS_ID) as FenceSettingsRow | undefined
    if (!row) {
      throw new AppError('INTERNAL', 'Fence 设置未初始化')
    }
    return mapSettings(row)
  }

  updateSettings(dto: UpdateDesktopFenceSettingsDto): DesktopFenceSettings {
    const current = this.getSettings()
    const ts = nowIso()
    const next: DesktopFenceSettings = {
      ...current,
      fencesEnabled: dto.fencesEnabled ?? current.fencesEnabled,
      fencesAlwaysOnTop: dto.fencesAlwaysOnTop ?? current.fencesAlwaysOnTop,
      hideNativeIcons: dto.hideNativeIcons ?? current.hideNativeIcons,
      updatedAt: ts
    }
    this.db
      .prepare(
        `UPDATE desktop_fence_settings SET
          fences_enabled = @fencesEnabled,
          fences_always_on_top = @fencesAlwaysOnTop,
          hide_native_icons = @hideNativeIcons,
          updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: SETTINGS_ID,
        fencesEnabled: next.fencesEnabled ? 1 : 0,
        fencesAlwaysOnTop: next.fencesAlwaysOnTop ? 1 : 0,
        hideNativeIcons: next.hideNativeIcons ? 1 : 0,
        updatedAt: ts
      })
    return next
  }

  listLayouts(): DesktopFenceLayout[] {
    const rows = this.db.prepare(`SELECT * FROM desktop_fence_layout`).all() as FenceLayoutRow[]
    return rows.map(mapLayout)
  }

  getLayout(categoryId: string): DesktopFenceLayout | null {
    const row = this.db
      .prepare(`SELECT * FROM desktop_fence_layout WHERE category_id = ?`)
      .get(categoryId) as FenceLayoutRow | undefined
    return row ? mapLayout(row) : null
  }

  /** 重新显示全部被用户关闭过的 Fence */
  setAllVisible(visible: boolean): void {
    const ts = nowIso()
    this.db
      .prepare(
        `UPDATE desktop_fence_layout SET visible = @visible, updated_at = @updatedAt`
      )
      .run({ visible: visible ? 1 : 0, updatedAt: ts })
  }

  /** 确保 3 个固定槽位有布局行 */
  ensureSlotLayouts(workArea: WorkAreaRect): DesktopFenceLayout[] {
    const ts = nowIso()
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO desktop_fence_layout
        (category_id, x, y, width, height, visible, updated_at)
       VALUES (@categoryId, @x, @y, @width, @height, 1, @updatedAt)`
    )
    const apply = this.db.transaction(() => {
      FENCE_SLOT_IDS.forEach((slotId) => {
        const defaults = defaultFenceSlotLayout(slotId, workArea)
        insert.run({
          categoryId: slotId,
          x: defaults.x,
          y: defaults.y,
          width: defaults.width,
          height: defaults.height,
          updatedAt: ts
        })
      })
    })
    apply()
    return FENCE_SLOT_IDS.map((id) => this.getLayout(id)).filter(
      (l): l is DesktopFenceLayout => l != null
    )
  }

  /** 仅同步宽高（保留用户拖拽的 y；右侧槽位随宽度重算 x） */
  syncSlotDimensions(workArea: WorkAreaRect): void {
    const settings = this.getSettings()
    if ((settings.layoutDimensionVersion ?? 1) >= FENCE_LAYOUT_DIMENSION_VERSION) return

    const ts = nowIso()
    const update = this.db.prepare(
      `UPDATE desktop_fence_layout SET
        x = @x, width = @width, height = @height, updated_at = @updatedAt
       WHERE category_id = @categoryId`
    )
    const apply = this.db.transaction(() => {
      FENCE_SLOT_IDS.forEach((slotId) => {
        const defaults = defaultFenceSlotLayout(slotId as FenceSlotId, workArea)
        update.run({
          categoryId: slotId,
          x: defaults.x,
          width: defaults.width,
          height: defaults.height,
          updatedAt: ts
        })
      })
      this.db
        .prepare(
          `UPDATE desktop_fence_settings SET layout_dimension_version = @version, updated_at = @updatedAt WHERE id = @id`
        )
        .run({
          id: SETTINGS_ID,
          version: FENCE_LAYOUT_DIMENSION_VERSION,
          updatedAt: ts
        })
    })
    apply()
  }

  /** 重置为参考图默认位置 */
  resetSlotLayouts(workArea: WorkAreaRect): void {
    const ts = nowIso()
    const update = this.db.prepare(
      `UPDATE desktop_fence_layout SET
        x = @x, y = @y, width = @width, height = @height,
        visible = 1, updated_at = @updatedAt
       WHERE category_id = @categoryId`
    )
    const apply = this.db.transaction(() => {
      FENCE_SLOT_IDS.forEach((slotId) => {
        const defaults = defaultFenceSlotLayout(slotId as FenceSlotId, workArea)
        update.run({
          categoryId: slotId,
          x: defaults.x,
          y: defaults.y,
          width: defaults.width,
          height: defaults.height,
          updatedAt: ts
        })
      })
    })
    apply()
    this.db
      .prepare(
        `UPDATE desktop_fence_settings SET layout_dimension_version = @version, updated_at = @updatedAt WHERE id = @id`
      )
      .run({
        id: SETTINGS_ID,
        version: FENCE_LAYOUT_DIMENSION_VERSION,
        updatedAt: ts
      })
  }

  updateLayout(categoryId: string, dto: UpdateDesktopFenceLayoutDto): DesktopFenceLayout {
    const current = this.getLayout(categoryId)
    if (!current) {
      throw new AppError('NOT_FOUND', 'Fence 布局不存在')
    }
    const ts = nowIso()
    const next: DesktopFenceLayout = {
      ...current,
      x: dto.x ?? current.x,
      y: dto.y ?? current.y,
      width: dto.width ?? current.width,
      height: dto.height ?? current.height,
      visible: dto.visible ?? current.visible,
      updatedAt: ts
    }
    this.db
      .prepare(
        `UPDATE desktop_fence_layout SET
          x = @x, y = @y, width = @width, height = @height,
          visible = @visible, updated_at = @updatedAt
         WHERE category_id = @categoryId`
      )
      .run({
        categoryId,
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
        visible: next.visible ? 1 : 0,
        updatedAt: ts
      })
    return next
  }
}

/** 桌面 Fence 全局设置 */
export interface DesktopFenceSettings {
  id: string
  fencesEnabled: boolean
  fencesAlwaysOnTop: boolean
  /** 开启桌面容器时隐藏 Windows 原生桌面图标 */
  hideNativeIcons: boolean
  /** 布局尺寸版本（用于自动加宽等迁移） */
  layoutDimensionVersion?: number
  updatedAt: string
}

export interface UpdateDesktopFenceSettingsDto {
  fencesEnabled?: boolean
  fencesAlwaysOnTop?: boolean
  hideNativeIcons?: boolean
}

/** 单个 Fence 槽位布局（categoryId 字段存 slot-apps / slot-folders / slot-files） */
export interface DesktopFenceLayout {
  categoryId: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  updatedAt: string
}

export interface UpdateDesktopFenceLayoutDto {
  x?: number
  y?: number
  width?: number
  height?: number
  visible?: boolean
}

/** Main → Fence 推送的扫描快照 */
export interface DesktopFenceScanPayload {
  scannedAt: string
  desktopPath: string
  folderPrefix: string
  categories: import('./desktop-organize-types').DesktopCategory[]
  items: import('./desktop-organize-types').DesktopScanItem[]
  moves: import('./desktop-organize-types').DesktopOrganizeMove[]
}

export interface DesktopWallpaperState {
  currentPath: string | null
  previousSystemPath: string | null
  appliedAt: string | null
  previewDataUrl: string | null
  systemPath?: string | null
}

export interface WallpaperPreset {
  id: string
  name: string
  filePath: string
  previewDataUrl: string | null
}

export type { FenceSlotId } from './fence-slot-config'
export { FENCE_SLOT_IDS, defaultFenceSlotLayout } from './fence-slot-config'

export type { FenceSlotId } from './fence-slot-config'
export { FENCE_SLOT_IDS, defaultFenceSlotLayout } from './fence-slot-config'

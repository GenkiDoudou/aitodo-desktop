/** 桌面整理：扫描条目类型 */
export type DesktopItemKind = 'file' | 'folder' | 'icon'

export type DesktopCategoryRule =
  | { type: 'kind'; value: DesktopItemKind }
  | { type: 'extension'; values: string[] }
  | { type: 'namePattern'; pattern: string }
  | { type: 'keyword'; value: string }
  | { type: 'manual'; itemPaths: string[] }

export interface DesktopCategory {
  id: string
  name: string
  targetFolderName: string
  icon: string
  color: string
  sortOrder: number
  enabled: boolean
  isSystem: boolean
  rules: DesktopCategoryRule[]
  createdAt: string
  updatedAt: string
}

export interface DesktopOrganizeSettings {
  folderPrefix: string
  layoutMode: 'flat_prefix'
  /** 扫描后自动整理 */
  autoOrganizeOnScan: boolean
  /** 启动时自动扫描桌面 */
  autoScanOnBoot: boolean
  /** 启动时自动整理（先扫描再执行移动） */
  autoOrganizeOnBoot: boolean
  /** 桌面出现新文件时自动整理 */
  autoOrganizeOnNewIcons: boolean
  updatedAt: string
}

export interface DesktopScanItem {
  name: string
  absolutePath: string
  kind: DesktopItemKind
  matchedCategoryId: string | null
}

export interface DesktopOrganizeMove {
  from: string
  to: string
  categoryId: string
  categoryName: string
  itemName: string
}

export interface DesktopOrganizePlan {
  scannedAt: string
  desktopPath: string
  items: DesktopScanItem[]
  moves: DesktopOrganizeMove[]
  skipped: Array<{ path: string; reason: string }>
}

export interface DesktopOrganizeExecuteResult {
  moved: DesktopOrganizeMove[]
  skipped: Array<{ path: string; reason: string }>
  snapshotId: string | null
}

export interface CreateDesktopCategoryDto {
  name: string
  targetFolderName?: string
  icon?: string
  color?: string
  sortOrder?: number
  enabled?: boolean
  rules?: DesktopCategoryRule[]
}

export interface UpdateDesktopCategoryDto {
  name?: string
  targetFolderName?: string
  icon?: string
  color?: string
  sortOrder?: number
  enabled?: boolean
  rules?: DesktopCategoryRule[]
}

export interface UpdateDesktopOrganizeSettingsDto {
  folderPrefix?: string
  autoOrganizeOnScan?: boolean
  autoScanOnBoot?: boolean
  autoOrganizeOnBoot?: boolean
  autoOrganizeOnNewIcons?: boolean
}

export type {
  CreateDesktopCustomRuleDto,
  DesktopCustomRule,
  DesktopDefaultRuleRow,
  UpdateDesktopCustomRuleDto
} from './desktop-custom-rules'

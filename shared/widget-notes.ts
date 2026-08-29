import type { WidgetCollapsePolicy, WidgetDisplayMode, WidgetEdgeAnchor } from './widget-display'
export type WidgetNoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'gray'

export const WIDGET_NOTE_COLORS: WidgetNoteColor[] = ['yellow', 'green', 'blue', 'pink', 'gray']

/** 挂件类型：每种类型对应一个独立窗口实例 */
export const WIDGET_KINDS = ['notes', 'matrix', 'view'] as const
export type WidgetKind = (typeof WIDGET_KINDS)[number]

export const WIDGET_KIND_LABELS: Record<WidgetKind, string> = {
  notes: '便签',
  matrix: '四象限',
  view: '视图'
}

/** 普通挂件默认尺寸 */
export const WIDGET_DEFAULT_WIDTH = 320
export const WIDGET_DEFAULT_HEIGHT = 420

/**
 * 看板视图挂件默认宽度：一排正好两列。
 * 计算：左右 padding 8*2 + 列间距 8 + 两列各 180 ≈ 384，取 392 留一点余量。
 */
export const WIDGET_KANBAN_DEFAULT_WIDTH = 392
export const WIDGET_KANBAN_DEFAULT_HEIGHT = 520

/** 清单名首字作为任务 logo（中文取首字，英文取首字母大写） */
export function categoryLogoInitial(name: string | null | undefined): string {
  const text = name?.trim()
  if (!text) return '未'
  return text.charAt(0).toUpperCase()
}

export interface WidgetNote {
  id: string
  content: string
  color: WidgetNoteColor
  pinned: boolean
  createdAt: string
  updatedAt: string
}

/** 全局挂件偏好（不含各实例几何信息） */
export interface WidgetSettings {
  id: string
  openOnStartup: boolean
  updatedAt: string
}

/** 单个桌面挂件实例 */
export interface WidgetInstance {
  id: string
  kind: WidgetKind
  /** kind 为 view 时必填 */
  viewId: string | null
  name: string
  x: number
  y: number
  width: number
  height: number
  alwaysOnTop: boolean
  sortOrder: number
  displayMode: WidgetDisplayMode
  collapsePolicy: WidgetCollapsePolicy
  idleTimeoutSec: number
  edgeAnchor: WidgetEdgeAnchor
  expandedX: number
  expandedY: number
  expandedWidth: number
  expandedHeight: number
  createdAt: string
  updatedAt: string
}

export interface CreateWidgetInstanceDto {
  kind: WidgetKind
  viewId?: string | null
  name?: string
}

export interface UpdateWidgetInstanceDto {
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  alwaysOnTop?: boolean
  sortOrder?: number
  displayMode?: WidgetDisplayMode
  collapsePolicy?: WidgetCollapsePolicy
  idleTimeoutSec?: number
  edgeAnchor?: WidgetEdgeAnchor
  expandedX?: number
  expandedY?: number
  expandedWidth?: number
  expandedHeight?: number
}

export interface CreateWidgetNoteDto {
  content?: string
  color?: WidgetNoteColor
}

export interface UpdateWidgetNoteDto {
  content?: string
  color?: WidgetNoteColor
  pinned?: boolean
}

/** 便签转任务：与快捷添加一致进收件箱；默认删除便签 */
export interface ConvertWidgetNoteToTaskDto {
  deleteNote?: boolean
}

export interface UpdateWidgetSettingsDto {
  openOnStartup?: boolean
}

export function widgetInstanceDisplayName(instance: Pick<WidgetInstance, 'kind' | 'name' | 'viewId'>): string {
  if (instance.name.trim()) {
    return instance.name.trim()
  }
  return WIDGET_KIND_LABELS[instance.kind]
}

/** 便签列表排序：置顶优先，其次 updatedAt 降序 */
export function sortWidgetNotes(notes: readonly WidgetNote[]): WidgetNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

/** 从便签正文提取任务标题：首行非空文本，否则全文 trim */
export function widgetNoteTitleFromContent(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean)
  const title = (line ?? content).trim()
  return title || '便签任务'
}

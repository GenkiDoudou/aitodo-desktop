import type { WidgetKind } from './widget-notes'

/** 挂件窗口展示状态（单窗口多状态） */
export const WIDGET_DISPLAY_MODES = ['hidden', 'edge_tab', 'mini', 'expanded'] as const
export type WidgetDisplayMode = (typeof WIDGET_DISPLAY_MODES)[number]

export const WIDGET_COLLAPSE_POLICIES = ['on_blur', 'manual', 'idle_timeout'] as const
export type WidgetCollapsePolicy = (typeof WIDGET_COLLAPSE_POLICIES)[number]

export const WIDGET_EDGE_ANCHORS = ['left', 'right', 'top', 'bottom'] as const
export type WidgetEdgeAnchor = (typeof WIDGET_EDGE_ANCHORS)[number]

export const WIDGET_EDGE_TAB_WIDTH = 28
/** 贴边细条沿边缘方向的最小长度（左右缘为高度，上下缘为宽度） */
export const WIDGET_EDGE_TAB_MIN_ALONG = 64
/** 贴边细条沿边缘方向的最大长度 */
export const WIDGET_EDGE_TAB_MAX_ALONG = 280
export const WIDGET_MINI_WIDTH = 148
export const WIDGET_MINI_HEIGHT = 56

export const WIDGET_DISPLAY_MODE_LABELS: Record<WidgetDisplayMode, string> = {
  hidden: '完全隐藏',
  edge_tab: '边缘细条',
  mini: '迷你卡片',
  expanded: '完整展开'
}

export const WIDGET_COLLAPSE_POLICY_LABELS: Record<WidgetCollapsePolicy, string> = {
  on_blur: '失焦收起',
  manual: '手动关闭',
  idle_timeout: '空闲超时收起'
}

export const WIDGET_EDGE_ANCHOR_LABELS: Record<WidgetEdgeAnchor, string> = {
  left: '左侧',
  right: '右侧',
  top: '顶部',
  bottom: '底部'
}

export interface WidgetExpandedBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WidgetDisplayConfig {
  displayMode: WidgetDisplayMode
  collapsePolicy: WidgetCollapsePolicy
  idleTimeoutSec: number
  edgeAnchor: WidgetEdgeAnchor
  expandedBounds: WidgetExpandedBounds
}

export function defaultDisplayModeForKind(_kind: WidgetKind): WidgetDisplayMode {
  return 'expanded'
}

export function defaultCollapsePolicyForKind(kind: WidgetKind): WidgetCollapsePolicy {
  return kind === 'notes' ? 'manual' : 'on_blur'
}

export function collapseTargetForKind(kind: WidgetKind): WidgetDisplayMode {
  return kind === 'notes' ? 'mini' : 'edge_tab'
}

export function isTaskWidgetKind(kind: WidgetKind): boolean {
  return kind === 'matrix' || kind === 'view'
}

export function sanitizeDisplayMode(value: unknown, fallback: WidgetDisplayMode): WidgetDisplayMode {
  return WIDGET_DISPLAY_MODES.includes(value as WidgetDisplayMode)
    ? (value as WidgetDisplayMode)
    : fallback
}

export function sanitizeCollapsePolicy(
  value: unknown,
  fallback: WidgetCollapsePolicy
): WidgetCollapsePolicy {
  return WIDGET_COLLAPSE_POLICIES.includes(value as WidgetCollapsePolicy)
    ? (value as WidgetCollapsePolicy)
    : fallback
}

export function sanitizeEdgeAnchor(value: unknown, fallback: WidgetEdgeAnchor): WidgetEdgeAnchor {
  return WIDGET_EDGE_ANCHORS.includes(value as WidgetEdgeAnchor)
    ? (value as WidgetEdgeAnchor)
    : fallback
}

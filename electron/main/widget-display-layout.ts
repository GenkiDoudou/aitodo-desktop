import type { Rectangle } from 'electron'
import type { WidgetDisplayMode, WidgetEdgeAnchor, WidgetExpandedBounds } from '@shared/widget-display'
import {
  WIDGET_EDGE_TAB_MAX_ALONG,
  WIDGET_EDGE_TAB_MIN_ALONG,
  WIDGET_EDGE_TAB_WIDTH,
  WIDGET_MINI_HEIGHT,
  WIDGET_MINI_WIDTH
} from '@shared/widget-display'

export interface WorkAreaRect {
  x: number
  y: number
  width: number
  height: number
}

/** 窗口距屏幕工作区边缘小于此值时贴边收成细条 */
export const WIDGET_EDGE_SNAP_THRESHOLD = 36

export interface StripPlacement {
  /** 沿边缘方向的位置：左右缘为 y，上下缘为 x */
  alongEdge: number
  label?: string
}

export interface StripOccupancy {
  along: number
  size: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function clampY(y: number, height: number, workArea: WorkAreaRect): number {
  return clamp(y, workArea.y, workArea.y + workArea.height - height)
}

function clampX(x: number, width: number, workArea: WorkAreaRect): number {
  return clamp(x, workArea.x, workArea.x + workArea.width - width)
}

function isHorizontalEdge(anchor: WidgetEdgeAnchor): boolean {
  return anchor === 'top' || anchor === 'bottom'
}

/** 根据挂件名称计算贴边细条尺寸（左右缘竖条、上下缘横条） */
export function stripDimensionsForLabel(
  anchor: WidgetEdgeAnchor,
  label: string
): { width: number; height: number } {
  const text = label.trim() || '挂件'
  const chars = [...text].length
  if (isHorizontalEdge(anchor)) {
    return {
      width: clamp(chars * 13 + 24, WIDGET_EDGE_TAB_MIN_ALONG, WIDGET_EDGE_TAB_MAX_ALONG),
      height: WIDGET_EDGE_TAB_WIDTH
    }
  }
  return {
    width: WIDGET_EDGE_TAB_WIDTH,
    height: clamp(chars * 14 + 24, WIDGET_EDGE_TAB_MIN_ALONG, WIDGET_EDGE_TAB_MAX_ALONG)
  }
}

/** 检测窗口是否靠近哪条工作区边缘（取最近且 within 阈值者） */
export function detectNearestDockEdge(
  bounds: Rectangle,
  workArea: WorkAreaRect,
  threshold = WIDGET_EDGE_SNAP_THRESHOLD
): WidgetEdgeAnchor | null {
  const toLeft = bounds.x - workArea.x
  const toRight = workArea.x + workArea.width - (bounds.x + bounds.width)
  const toTop = bounds.y - workArea.y
  const toBottom = workArea.y + workArea.height - (bounds.y + bounds.height)

  const candidates: { edge: WidgetEdgeAnchor; dist: number }[] = [
    { edge: 'left', dist: toLeft },
    { edge: 'right', dist: toRight },
    { edge: 'top', dist: toTop },
    { edge: 'bottom', dist: toBottom }
  ].filter((c) => c.dist >= 0 && c.dist <= threshold)

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.dist - b.dist)
  return candidates[0].edge
}

/** 避免同一边缘上多个细条重叠，沿边缘方向找可用位置 */
export function resolveStripAlongEdge(
  anchor: WidgetEdgeAnchor,
  desiredAlong: number,
  stripAlongSize: number,
  workArea: WorkAreaRect,
  occupied: readonly StripOccupancy[],
  gap = 6
): number {
  const minAlong = isHorizontalEdge(anchor) ? workArea.x : workArea.y
  const maxAlong = isHorizontalEdge(anchor)
    ? workArea.x + workArea.width - stripAlongSize
    : workArea.y + workArea.height - stripAlongSize

  const overlaps = (pos: number, blocks: readonly StripOccupancy[]) =>
    blocks.some(
      (o) => pos < o.along + o.size + gap && pos + stripAlongSize + gap > o.along
    )

  let pos = clamp(desiredAlong, minAlong, maxAlong)
  if (!overlaps(pos, occupied)) {
    return pos
  }

  const sorted = [...occupied].sort((a, b) => a.along - b.along)
  for (const block of sorted) {
    const after = block.along + block.size + gap
    if (after <= maxAlong && !overlaps(after, occupied)) {
      return after
    }
  }

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const before = sorted[i].along - stripAlongSize - gap
    if (before >= minAlong && !overlaps(before, occupied)) {
      return before
    }
  }

  return pos
}

/** 贴边细条窗口 bounds（位置沿拖动点，尺寸随名称） */
export function stripBoundsForEdge(
  anchor: WidgetEdgeAnchor,
  placement: StripPlacement,
  workArea: WorkAreaRect,
  dimensions?: { width: number; height: number }
): Rectangle {
  const size = dimensions ?? stripDimensionsForLabel(anchor, placement.label ?? '挂件')
  const { width, height } = size

  switch (anchor) {
    case 'left':
      return { x: workArea.x, y: clampY(placement.alongEdge, height, workArea), width, height }
    case 'right':
      return {
        x: workArea.x + workArea.width - width,
        y: clampY(placement.alongEdge, height, workArea),
        width,
        height
      }
    case 'top':
      return { x: clampX(placement.alongEdge, width, workArea), y: workArea.y, width, height }
    case 'bottom':
      return {
        x: clampX(placement.alongEdge, width, workArea),
        y: workArea.y + workArea.height - height,
        width,
        height
      }
    default:
      return {
        x: workArea.x + workArea.width - width,
        y: clampY(placement.alongEdge, height, workArea),
        width,
        height
      }
  }
}

/** 从展开窗口 bounds 推算贴边时沿边缘的期望位置（居中对齐拖动区域） */
export function desiredStripAlongFromBounds(
  anchor: WidgetEdgeAnchor,
  fromBounds: Rectangle,
  stripAlongSize: number
): number {
  if (isHorizontalEdge(anchor)) {
    return fromBounds.x + Math.round((fromBounds.width - stripAlongSize) / 2)
  }
  return fromBounds.y + Math.round((fromBounds.height - stripAlongSize) / 2)
}

/** 展开时恢复用户设定的完整尺寸（仅钳位到工作区内） */
export function expandedWindowBounds(
  expanded: WidgetExpandedBounds,
  workArea: WorkAreaRect
): Rectangle {
  return {
    x: clampX(expanded.x, expanded.width, workArea),
    y: clampY(expanded.y, expanded.height, workArea),
    width: expanded.width,
    height: expanded.height
  }
}

/**
 * 贴边悬停预览：以细条所在边为锚点就地展开，使指针仍落在窗口内，
 * 避免跳回历史 expanded 坐标导致「鼠标没动却 leave」。
 */
export function peekExpandedBoundsNearStrip(
  anchor: WidgetEdgeAnchor,
  strip: Rectangle,
  expanded: WidgetExpandedBounds,
  workArea: WorkAreaRect
): Rectangle {
  const width = expanded.width
  const height = expanded.height

  if (anchor === 'right') {
    return {
      x: clampX(strip.x + strip.width - width, width, workArea),
      y: clampY(strip.y + Math.round((strip.height - height) / 2), height, workArea),
      width,
      height
    }
  }
  if (anchor === 'left') {
    return {
      x: clampX(strip.x, width, workArea),
      y: clampY(strip.y + Math.round((strip.height - height) / 2), height, workArea),
      width,
      height
    }
  }
  if (anchor === 'top') {
    return {
      x: clampX(strip.x + Math.round((strip.width - width) / 2), width, workArea),
      y: clampY(strip.y, height, workArea),
      width,
      height
    }
  }
  // bottom
  return {
    x: clampX(strip.x + Math.round((strip.width - width) / 2), width, workArea),
    y: clampY(strip.y + strip.height - height, height, workArea),
    width,
    height
  }
}

/** 根据展示状态计算窗口 bounds；hidden 返回 null */
export function boundsForDisplayMode(
  mode: WidgetDisplayMode,
  expanded: WidgetExpandedBounds,
  edgeAnchor: WidgetEdgeAnchor,
  workArea: WorkAreaRect,
  stripOptions?: { alongEdge: number; label?: string }
): Rectangle | null {
  if (mode === 'hidden') {
    return null
  }
  if (mode === 'expanded') {
    return expandedWindowBounds(expanded, workArea)
  }
  if (mode === 'mini') {
    const width = WIDGET_MINI_WIDTH
    const height = WIDGET_MINI_HEIGHT
    return {
      x: clampX(expanded.x, width, workArea),
      y: clampY(expanded.y, height, workArea),
      width,
      height
    }
  }
  const alongEdge =
    stripOptions?.alongEdge ??
    (isHorizontalEdge(edgeAnchor) ? expanded.x : expanded.y)
  return stripBoundsForEdge(
    edgeAnchor,
    { alongEdge, label: stripOptions?.label },
    workArea
  )
}

export function expandedBoundsFromInstance(instance: {
  expandedX: number
  expandedY: number
  expandedWidth: number
  expandedHeight: number
  x: number
  y: number
  width: number
  height: number
}): WidgetExpandedBounds {
  return {
    x: instance.expandedX ?? instance.x,
    y: instance.expandedY ?? instance.y,
    width: instance.expandedWidth ?? instance.width,
    height: instance.expandedHeight ?? instance.height
  }
}

/** 读取已贴边细条沿边缘方向的位置 */
export function stripAlongFromInstance(
  anchor: WidgetEdgeAnchor,
  instance: { x: number; y: number }
): number {
  return isHorizontalEdge(anchor) ? instance.x : instance.y
}

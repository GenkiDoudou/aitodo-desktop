import { describe, expect, it } from 'vitest'
import {
  detectNearestDockEdge,
  desiredStripAlongFromBounds,
  expandedWindowBounds,
  resolveStripAlongEdge,
  stripBoundsForEdge,
  stripDimensionsForLabel,
  WIDGET_EDGE_SNAP_THRESHOLD
} from '../electron/main/widget-display-layout'
import { WIDGET_EDGE_TAB_WIDTH } from './widget-display'

const workArea = { x: 0, y: 0, width: 1920, height: 1040 }

describe('detectNearestDockEdge', () => {
  it('detects right edge proximity', () => {
    const bounds = { x: 1576, y: 300, width: 320, height: 420 }
    expect(detectNearestDockEdge(bounds, workArea, WIDGET_EDGE_SNAP_THRESHOLD)).toBe('right')
  })

  it('returns null when far from edges', () => {
    const bounds = { x: 400, y: 300, width: 320, height: 420 }
    expect(detectNearestDockEdge(bounds, workArea)).toBeNull()
  })
})

describe('stripDimensionsForLabel', () => {
  it('grows vertical strip height with longer names', () => {
    const short = stripDimensionsForLabel('right', '便签')
    const long = stripDimensionsForLabel('right', '我的四象限任务面板')
    expect(long.height).toBeGreaterThan(short.height)
    expect(short.width).toBe(WIDGET_EDGE_TAB_WIDTH)
  })
})

describe('stripBoundsForEdge', () => {
  it('places strip at dragged along-edge position on right', () => {
    const dims = stripDimensionsForLabel('right', '便签')
    const strip = stripBoundsForEdge('right', { alongEdge: 300, label: '便签' }, workArea, dims)
    expect(strip.width).toBe(WIDGET_EDGE_TAB_WIDTH)
    expect(strip.y).toBe(300)
    expect(strip.x).toBe(workArea.width - WIDGET_EDGE_TAB_WIDTH)
  })
})

describe('resolveStripAlongEdge', () => {
  it('nudges strip when overlapping another on same edge', () => {
    const dims = stripDimensionsForLabel('right', '便签')
    const along = resolveStripAlongEdge('right', 300, dims.height, workArea, [
      { along: 300, size: dims.height }
    ])
    expect(along).toBeGreaterThan(300)
  })
})

describe('desiredStripAlongFromBounds', () => {
  it('centers strip along edge from expanded window', () => {
    const dims = stripDimensionsForLabel('right', '便签')
    const along = desiredStripAlongFromBounds(
      'right',
      { x: 400, y: 200, width: 320, height: 420 },
      dims.height
    )
    expect(along).toBe(200 + Math.round((420 - dims.height) / 2))
  })
})

describe('expandedWindowBounds', () => {
  it('restores exact user expanded size', () => {
    const bounds = expandedWindowBounds({ x: 400, y: 300, width: 392, height: 520 }, workArea)
    expect(bounds.width).toBe(392)
    expect(bounds.height).toBe(520)
  })
})

describe('widget display defaults', () => {
  it('new widgets start expanded for drag-to-edge', async () => {
    const { defaultDisplayModeForKind } = await import('./widget-display')
    expect(defaultDisplayModeForKind('notes')).toBe('expanded')
    expect(defaultDisplayModeForKind('matrix')).toBe('expanded')
  })
})

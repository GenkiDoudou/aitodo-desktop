/** 固定 3 槽位 Fence 布局（对齐参考图：左应用 / 右上文件夹 / 右下文件 Tab） */
export type FenceSlotId = 'slot-apps' | 'slot-folders' | 'slot-files'

export const FENCE_SLOT_IDS: FenceSlotId[] = ['slot-apps', 'slot-folders', 'slot-files']

export interface FenceTabDefinition {
  tabId: string
  label: string
  /** 按分类 id 过滤；与 filter 二选一 */
  categoryId?: string
  /** 虚拟 Tab（如视频扩展名） */
  filter?: 'video' | 'all-files'
}

export interface FenceSlotDefinition {
  id: FenceSlotId
  title: string
  icon: string
  mode: 'grid' | 'tabs'
  /** grid 模式使用的单一分类 */
  categoryId?: string
  tabs?: FenceTabDefinition[]
}

export const FENCE_SLOTS: Record<FenceSlotId, FenceSlotDefinition> = {
  'slot-apps': {
    id: 'slot-apps',
    title: '应用',
    icon: '▦',
    mode: 'grid',
    categoryId: 'icon'
  },
  'slot-folders': {
    id: 'slot-folders',
    title: '文件夹',
    icon: '▣',
    mode: 'grid',
    categoryId: 'folder'
  },
  'slot-files': {
    id: 'slot-files',
    title: '图标',
    icon: '▤',
    mode: 'tabs',
    tabs: [
      { tabId: 'cat-docs', label: '文档', categoryId: 'cat-docs' },
      { tabId: 'cat-images', label: '图片', categoryId: 'cat-images' },
      { tabId: 'video', label: '视频', filter: 'video' },
      { tabId: 'file', label: '其它', categoryId: 'file' },
      { tabId: 'all', label: '全部', filter: 'all-files' }
    ]
  }
}

export function getFenceSlot(slotId: string): FenceSlotDefinition | null {
  return FENCE_SLOTS[slotId as FenceSlotId] ?? null
}

const VIDEO_EXT = /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v)$/i

/** Tab 内展示条目 */
export function filterItemsForFenceTab(
  items: import('./desktop-organize-types').DesktopScanItem[],
  tab: FenceTabDefinition
): import('./desktop-organize-types').DesktopScanItem[] {
  if (tab.categoryId) {
    return items.filter((i) => i.matchedCategoryId === tab.categoryId)
  }
  if (tab.filter === 'video') {
    return items.filter((i) => VIDEO_EXT.test(i.name))
  }
  if (tab.filter === 'all-files') {
    return items.filter((i) => i.matchedCategoryId !== 'icon' && i.matchedCategoryId !== 'folder')
  }
  return []
}

/** drop 目标分类 id */
export function dropCategoryForFenceTab(tab: FenceTabDefinition): string {
  if (tab.categoryId) return tab.categoryId
  if (tab.filter === 'video') return 'file'
  return 'file'
}

export interface WorkAreaRect {
  x: number
  y: number
  width: number
  height: number
}

/** 槽位默认宽度（变更时递增，用于迁移后自动加宽） */
export const FENCE_LAYOUT_DIMENSION_VERSION = 3

/** 参考图默认位置（相对 workArea） */
export function defaultFenceSlotLayout(
  slotId: FenceSlotId,
  workArea: WorkAreaRect
): { x: number; y: number; width: number; height: number } {
  const margin = 16
  // 左约 32%、右约 30%，更接近参考图比例
  const rightW = Math.min(520, Math.max(440, Math.floor(workArea.width * 0.3)))
  const leftW = Math.min(560, Math.max(460, Math.floor(workArea.width * 0.32)))
  const topRightH = 240
  const gap = 12

  switch (slotId) {
    case 'slot-apps':
      return {
        x: workArea.x + margin,
        y: workArea.y + margin,
        width: leftW,
        height: workArea.height - margin * 2
      }
    case 'slot-folders':
      return {
        x: workArea.x + workArea.width - rightW - margin,
        y: workArea.y + margin,
        width: rightW,
        height: topRightH
      }
    case 'slot-files':
      return {
        x: workArea.x + workArea.width - rightW - margin,
        y: workArea.y + margin + topRightH + gap,
        width: rightW,
        height: workArea.height - topRightH - margin * 2 - gap
      }
  }
}

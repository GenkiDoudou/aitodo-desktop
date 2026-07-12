import { describe, expect, it } from 'vitest'
import type { DesktopScanItem } from './desktop-organize-types'
import { filterItemsForFenceTab, FENCE_SLOTS } from './fence-slot-config'

function item(name: string, categoryId: string): DesktopScanItem {
  return {
    name,
    absolutePath: `C:/Desktop/${name}`,
    kind: 'file',
    matchedCategoryId: categoryId
  }
}

describe('filterItemsForFenceTab', () => {
  const items = [
    item('a.pdf', 'cat-docs'),
    item('b.jpg', 'cat-images'),
    item('c.mp4', 'file'),
    item('d.txt', 'file'),
    item('app.lnk', 'icon'),
    item('folder', 'folder')
  ]

  it('文档 Tab 只显示 cat-docs', () => {
    const tab = FENCE_SLOTS['slot-files'].tabs!.find((t) => t.tabId === 'cat-docs')!
    expect(filterItemsForFenceTab(items, tab).map((i) => i.name)).toEqual(['a.pdf'])
  })

  it('视频 Tab 按扩展名过滤', () => {
    const tab = FENCE_SLOTS['slot-files'].tabs!.find((t) => t.tabId === 'video')!
    expect(filterItemsForFenceTab(items, tab).map((i) => i.name)).toEqual(['c.mp4'])
  })

  it('全部 Tab 排除应用与文件夹', () => {
    const tab = FENCE_SLOTS['slot-files'].tabs!.find((t) => t.tabId === 'all')!
    const names = filterItemsForFenceTab(items, tab).map((i) => i.name)
    expect(names).toEqual(['a.pdf', 'b.jpg', 'c.mp4', 'd.txt'])
  })
})

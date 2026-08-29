import { describe, expect, it } from 'vitest'
import { filterSlashMenuItems, SLASH_MENU_ITEMS } from './task-editor-blocks'

describe('task-editor-blocks', () => {
  it('lists all slash menu items by default', () => {
    expect(filterSlashMenuItems('')).toHaveLength(SLASH_MENU_ITEMS.length)
  })

  it('filters by label keyword', () => {
    const items = filterSlashMenuItems('标题')
    expect(items.some((i) => i.id === 'h1')).toBe(true)
  })
})

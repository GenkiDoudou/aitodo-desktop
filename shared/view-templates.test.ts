import { describe, expect, it } from 'vitest'
import { VIEW_TEMPLATES, getViewTemplate } from './view-templates'
import { validateFilterNode } from './task-filter-ast'

describe('view-templates', () => {
  it('has eight templates with valid presets', () => {
    expect(VIEW_TEMPLATES).toHaveLength(8)
    for (const tpl of VIEW_TEMPLATES) {
      expect(tpl.preset.name).toBeTruthy()
      expect(tpl.preset.layout).toBeTruthy()
      if (tpl.preset.filterRule) {
        expect(validateFilterNode(tpl.preset.filterRule)).toBeNull()
      }
      if (tpl.preset.layout === 'kanban') {
        expect(tpl.preset.kanbanBoardMode).toBeTruthy()
      }
    }
  })

  it('getViewTemplate returns kanban', () => {
    const tpl = getViewTemplate('kanban')
    expect(tpl?.preset.layout).toBe('kanban')
  })
})

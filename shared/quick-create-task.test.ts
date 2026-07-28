import { describe, expect, it } from 'vitest'
import { buildQuickCreateTaskDto, toParseCategories } from './quick-create-task'

describe('quick-create-task', () => {
  it('toParseCategories includes keywords', () => {
    const refs = toParseCategories([{ id: '1', name: '工作', keywords: ['开会'] }])
    expect(refs[0]).toEqual({ id: '1', name: '工作', keywords: ['开会'] })
  })

  it('toParseCategories returns structured-cloneable plain data', () => {
    const reactiveLike = [{ id: '1', name: '工作', keywords: ['开会'] }]
    const refs = toParseCategories(reactiveLike)
    expect(() => structuredClone(refs)).not.toThrow()
    expect(refs[0].keywords).not.toBe(reactiveLike[0].keywords)
  })

  it('matches category by keyword', () => {
    const cats = [{ id: '1', name: '工作', keywords: ['开会'] }]
    const dto = buildQuickCreateTaskDto('下午开会', cats)
    expect(dto.categoryId).toBe('1')
    expect(dto.title.length).toBeGreaterThan(0)
  })

  it('matches category by name', () => {
    const cats = [{ id: '2', name: '生活', keywords: [] }]
    const dto = buildQuickCreateTaskDto('买菜 生活', cats)
    expect(dto.categoryId).toBe('2')
  })

  it('defaults triagedAt unset so create path can leave inbox', () => {
    const dto = buildQuickCreateTaskDto('随便写点', [])
    expect(dto.triagedAt).toBeUndefined()
  })

  it('leaves categoryId null when no category matches', () => {
    const cats = [{ id: '1', name: '工作', keywords: ['开会'] }]
    const dto = buildQuickCreateTaskDto('随便写点', cats)
    expect(dto.categoryId).toBeNull()
  })
})

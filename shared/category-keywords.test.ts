import { describe, expect, it } from 'vitest'
import {
  findCategoryKeywordConflict,
  matchCategoryByKeywords,
  normalizeCategoryKeywords,
  resolveCreateCategoryId
} from './category-keywords'

describe('normalizeCategoryKeywords', () => {
  it('dedupes within list case-insensitively', () => {
    expect(normalizeCategoryKeywords(['会议', ' 会议 ', '周报', '周报'])).toEqual(['会议', '周报'])
  })
})

describe('findCategoryKeywordConflict', () => {
  const all = [
    { id: 'c1', name: '工作', keywords: ['会议', '周报'] },
    { id: 'c2', name: '生活', keywords: ['买菜'] }
  ]

  it('detects global duplicate', () => {
    expect(findCategoryKeywordConflict(['会议'], all)).toMatch(/工作/)
    expect(findCategoryKeywordConflict(['买菜'], all, 'c2')).toBeNull()
  })
})

describe('matchCategoryByKeywords', () => {
  const categories = [
    { id: 'c-work', name: '工作', keywords: ['会议', '周例会'] },
    { id: 'c-life', name: '生活', keywords: ['买菜'] }
  ]

  it('matches substring and prefers longest keyword', () => {
    expect(matchCategoryByKeywords('下午周例会讨论', categories)?.id).toBe('c-work')
    expect(matchCategoryByKeywords('去超市买菜', categories)?.id).toBe('c-life')
  })

  it('returns null when no hit', () => {
    expect(matchCategoryByKeywords('写文档', categories)).toBeNull()
  })
})

describe('resolveCreateCategoryId', () => {
  const categories = [{ id: 'c-work', name: '工作', keywords: ['会议'] }]

  it('prefers parsed category over nav and keywords', () => {
    expect(resolveCreateCategoryId('开会', 'c-life', 'c-nav', categories)).toBe('c-life')
  })

  it('uses nav when parsed missing', () => {
    expect(resolveCreateCategoryId('写文档', null, 'c-nav', categories)).toBe('c-nav')
  })

  it('falls back to keywords when parsed and nav missing', () => {
    expect(resolveCreateCategoryId('下午会议讨论', null, null, categories)).toBe('c-work')
  })
})

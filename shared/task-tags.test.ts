import { describe, expect, it } from 'vitest'
import {
  extractTagsFromText,
  extractTaskTags,
  normalizeTagName,
  normalizeTagNames,
  primaryTaskTag
} from './task-tags'

describe('task-tags', () => {
  it('extracts tags from title', () => {
    expect(extractTagsFromText('写报告 #工作 #紧急', null)).toEqual(['工作', '紧急'])
  })

  it('prefers persisted tags over text parsing', () => {
    expect(
      extractTaskTags({ title: '写报告 #旧标签', description: null, tags: ['工作', '紧急'] })
    ).toEqual(['工作', '紧急'])
  })

  it('falls back to text parsing when tags empty', () => {
    expect(
      primaryTaskTag({ title: '任务', description: '备注 #微信采集 内容', tags: [] })
    ).toBe('微信采集')
  })

  it('normalizes tag names', () => {
    expect(normalizeTagName(' #工作 ')).toBe('工作')
    expect(normalizeTagName('bad tag!')).toBeNull()
    expect(normalizeTagNames(['工作', '工作', '#紧急'])).toEqual(['工作', '紧急'])
  })
})

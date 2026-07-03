import { describe, expect, it } from 'vitest'
import { extractTaskTags, primaryTaskTag } from './task-tags'

describe('task-tags', () => {
  it('extracts tags from title', () => {
    expect(extractTaskTags({ title: '写报告 #工作 #紧急', description: null })).toEqual(['工作', '紧急'])
  })

  it('extracts tags from description markdown', () => {
    expect(
      primaryTaskTag({ title: '任务', description: '备注 #微信采集 内容' })
    ).toBe('微信采集')
  })
})

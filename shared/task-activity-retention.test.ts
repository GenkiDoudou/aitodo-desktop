import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TASK_ACTIVITY_RETENTION,
  mergeTaskActivityRetention,
  validateTaskActivityRetention
} from './task-activity-retention'

describe('task-activity-retention', () => {
  it('defaults to forever', () => {
    expect(mergeTaskActivityRetention()).toEqual(DEFAULT_TASK_ACTIVITY_RETENTION)
  })

  it('merges max_count policy', () => {
    expect(mergeTaskActivityRetention({ mode: 'max_count', maxCount: 500 })).toEqual({
      mode: 'max_count',
      maxCount: 500
    })
  })

  it('validates invalid max_days', () => {
    expect(validateTaskActivityRetention({ mode: 'max_days' })).toBe('请填写有效的保留天数')
  })
})

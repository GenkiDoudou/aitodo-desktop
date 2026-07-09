import type { TaskActivityRetentionPolicy } from './types'

export const DEFAULT_TASK_ACTIVITY_RETENTION: TaskActivityRetentionPolicy = {
  mode: 'forever'
}

export const DEFAULT_TASK_ACTIVITY_MAX_COUNT = 2000
export const DEFAULT_TASK_ACTIVITY_MAX_DAYS = 180

export function mergeTaskActivityRetention(
  partial?: Partial<TaskActivityRetentionPolicy> | null
): TaskActivityRetentionPolicy {
  if (!partial?.mode) {
    return { ...DEFAULT_TASK_ACTIVITY_RETENTION }
  }
  if (partial.mode === 'max_count') {
    return {
      mode: 'max_count',
      maxCount: normalizePositiveInt(partial.maxCount, DEFAULT_TASK_ACTIVITY_MAX_COUNT)
    }
  }
  if (partial.mode === 'max_days') {
    return {
      mode: 'max_days',
      maxDays: normalizePositiveInt(partial.maxDays, DEFAULT_TASK_ACTIVITY_MAX_DAYS)
    }
  }
  return { mode: 'forever' }
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 1) {
    return fallback
  }
  return n
}

/** 校验保留策略；无效时返回错误文案 */
export function validateTaskActivityRetention(policy: TaskActivityRetentionPolicy): string | null {
  if (policy.mode === 'forever') {
    return null
  }
  if (policy.mode === 'max_count') {
    if (!policy.maxCount || policy.maxCount < 1) {
      return '请填写有效的最大保留条数'
    }
    return null
  }
  if (policy.mode === 'max_days') {
    if (!policy.maxDays || policy.maxDays < 1) {
      return '请填写有效的保留天数'
    }
    return null
  }
  return '无效的保留策略'
}

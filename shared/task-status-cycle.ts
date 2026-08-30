import type { TaskStatus } from './types'

/**
 * 任务三态流转：待办 → 进行中 → 已完成 → 待办（与 quick-h5 / 看板状态列一致）。
 */

/** 圆圈点击后的下一工作态 */
export function nextTaskStatus(current: TaskStatus): TaskStatus {
  if (current === 'TODO') {
    return 'IN_PROGRESS'
  }
  if (current === 'IN_PROGRESS') {
    return 'DONE'
  }
  return 'TODO'
}

/** 三态中文标签（详情/分组展示） */
export function taskStatusLabel(status: TaskStatus): string {
  if (status === 'IN_PROGRESS') {
    return '进行中'
  }
  if (status === 'DONE') {
    return '已完成'
  }
  return '待办'
}

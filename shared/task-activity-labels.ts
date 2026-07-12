import type { TaskActivityType } from './types'

/** 动态类型在 UI 中的简短标签 */
export const TASK_ACTIVITY_TYPE_LABELS: Record<TaskActivityType, string> = {
  created: '创建',
  title_updated: '标题',
  description_updated: '正文',
  priority_updated: '优先级',
  category_updated: '清单',
  tags_updated: '标签',
  due_updated: '截止时间',
  start_updated: '开始时间',
  reminders_updated: '提醒',
  recurrence_updated: '重复',
  kanban_group_updated: '看板分组',
  subtask_added: '子任务',
  subtask_removed: '子任务',
  subtask_completed: '子任务',
  subtask_reopened: '子任务',
  completed: '完成',
  reopened: '重新打开',
  deleted: '删除',
  restored: '恢复',
  permanently_deleted: '彻底删除'
}

export function taskActivityTypeLabel(type: TaskActivityType): string {
  return TASK_ACTIVITY_TYPE_LABELS[type] ?? type
}

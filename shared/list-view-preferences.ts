/** 任务列表区域视图：列表 / 看板 / 时间线 */
export type TaskListViewMode = 'list' | 'kanban' | 'timeline'

/** 任务详情展示方式 */
export type TaskDetailStyle = 'sidebar' | 'dialog'

/** 列表行内展示哪些时间字段 */
export interface TaskListMetaVisibility {
  createdAt: boolean
  dueAt: boolean
  remindAt: boolean
  completedAt: boolean
}

export const DEFAULT_TASK_LIST_META_VISIBILITY: TaskListMetaVisibility = {
  createdAt: true,
  dueAt: true,
  remindAt: true,
  completedAt: true
}

export const TASK_LIST_VIEW_MODE_LABELS: Record<TaskListViewMode, string> = {
  list: '列表视图',
  kanban: '看板视图',
  timeline: '时间线视图'
}

export const TASK_DETAIL_STYLE_LABELS: Record<TaskDetailStyle, string> = {
  sidebar: '侧边栏',
  dialog: '弹框详情'
}

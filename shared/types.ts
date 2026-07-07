/** 与 AGENTS.md / 后端约定一致的任务状态枚举 */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

/** 艾森豪威尔四象限优先级 */
export type { TaskPriority } from './task-priority'

/** ISO 本地时间字符串：yyyy-MM-ddTHH:mm:ss */
export type IsoDateTime = string

export type { TaskReminderItem, TaskRecurrenceRule, TaskReminderInput } from './task-reminder'
export type {
  ScheduledSummary,
  CreateScheduledSummaryDto,
  UpdateScheduledSummaryDto,
  SummaryScheduleType
} from './scheduled-summary'

export interface Category {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  deletedAt: IsoDateTime | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  /** 1=重要紧急 … 4=不重要不紧急，默认 4 */
  priority: import('./task-priority').TaskPriority
  categoryId: string | null
  parentId: string | null
  dueAt: IsoDateTime | null
  remindAt: IsoDateTime | null
  remindFiredAt: IsoDateTime | null
  completedAt: IsoDateTime | null
  sortOrder: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  deletedAt: IsoDateTime | null
  syncVersion: number
  /** 看板自定义分组 id；null 表示「未分组」列 */
  kanbanGroupId: string | null
  /** 多条提醒（详情加载时填充） */
  reminders?: import('./task-reminder').TaskReminderItem[]
  /** 循环规则；null 表示不重复 */
  recurrence?: import('./task-reminder').TaskRecurrenceRule | null
  /** 持续提醒：触发后仍按间隔重复通知直至处理 */
  remindContinuous?: boolean
}

/** IPC 统一成功/失败信封 */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export interface CreateTaskDto {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: import('./task-priority').TaskPriority
  categoryId?: string | null
  parentId?: string | null
  dueAt?: IsoDateTime | null
  remindAt?: IsoDateTime | null
  reminders?: import('./task-reminder').TaskReminderInput[]
  recurrence?: import('./task-reminder').TaskRecurrenceRule | null
  remindContinuous?: boolean
  sortOrder?: number
  kanbanGroupId?: string | null
}

export interface UpdateTaskDto {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: import('./task-priority').TaskPriority
  categoryId?: string | null
  parentId?: string | null
  dueAt?: IsoDateTime | null
  remindAt?: IsoDateTime | null
  reminders?: import('./task-reminder').TaskReminderInput[]
  recurrence?: import('./task-reminder').TaskRecurrenceRule | null
  remindContinuous?: boolean
  sortOrder?: number
  kanbanGroupId?: string | null
}

/** 看板列（按 scope 隔离） */
export interface KanbanGroup {
  id: string
  scopeKey: string
  name: string
  sortOrder: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface CreateKanbanGroupDto {
  scopeKey: string
  name: string
  position?: 'end' | 'before' | 'after'
  refGroupId?: string
}

export interface UpdateKanbanGroupDto {
  name?: string
  sortOrder?: number
  /** 重命名未分组列时必传，用于定位 scope */
  scopeKey?: string
}

/** 看板分组列表（自定义列 + 未分组显示名） */
export interface KanbanBoardGroupsResult {
  groups: KanbanGroup[]
  ungroupedName: string
}

/** 删除任务：有子任务时必须 cascadeChildren=true 才会执行 */
export interface DeleteTaskOptions {
  cascadeChildren?: boolean
}

export interface CreateCategoryDto {
  name: string
  color?: string | null
  sortOrder?: number
}

export interface UpdateCategoryDto {
  name?: string
  color?: string | null
  sortOrder?: number
}

/** 任务列表筛选：智能列表与侧栏导航共用 */
export type SmartList = 'all' | 'today' | 'week' | 'last7days' | 'done' | 'trash'

export type { TaskDateField, DoneTimeRange, CalendarRangePreset } from './date-filter'

export interface TaskListFilter {
  smartList?: SmartList
  categoryId?: string | null
  status?: TaskStatus
  hideDone?: boolean
  parentId?: string | null
  search?: string
  /** 今天/本周/最近7天：按哪列时间筛选，默认 dueAt */
  dateField?: import('./date-filter').TaskDateField
  /** 已完成页：本日/本周/本月/自定义/全部 */
  doneTimeRange?: import('./date-filter').DoneTimeRange
  /** 自定义区间起止（doneTimeRange=custom 或日历 custom 时使用），ISO 本地日 */
  dateFrom?: IsoDateTime | null
  dateTo?: IsoDateTime | null
}

export interface SetDataPathResult {
  /** 新路径已写入 config，需重启后生效 */
  requiresRestart: true
  pendingPath: string
}

export interface AppInfo {
  version: string
  dataPath: string
  /** 安装目录旁的默认数据路径（便携模式） */
  defaultDataPath: string
  writable: boolean
}

/** 应用内消息：通知（提醒等）与动态（操作记录） */
export type AppMessageKind = 'notification' | 'activity'

export type AppMessageSource = 'task_reminder' | 'scheduled_summary'

export interface AppMessage {
  id: string
  kind: AppMessageKind
  title: string
  body: string | null
  /** 关联任务，点击可跳转详情 */
  taskId: string | null
  /** 消息来源，便于首页汇总与通知区分展示 */
  source: AppMessageSource | null
  readAt: IsoDateTime | null
  createdAt: IsoDateTime
}

export interface CreateAppMessageDto {
  kind: AppMessageKind
  title: string
  body?: string | null
  taskId?: string | null
  source?: AppMessageSource | null
}

/** 业务层可抛出的已知错误，由 IPC 包装为 error.code */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

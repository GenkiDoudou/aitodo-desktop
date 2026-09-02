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

export type { FilterNode, FilterField, FilterOp } from './task-filter-ast'

export type TaskViewLayout = 'list' | 'kanban' | 'timeline' | 'quadrant'

/** 四象限视图布局选项（存 task_views.quadrant_options_json） */
export type { QuadrantLayoutOptions as TaskViewQuadrantOptions } from './quadrant-layout'

/** 命名任务视图（对齐 GitHub Projects View） */
export interface TaskView {
  id: string
  name: string
  layout: TaskViewLayout
  scopeKey: string | null
  filterRule: import('./task-filter-ast').FilterNode | null
  groupBy: import('./task-list-layout').TaskGroupBy
  sortBy: import('./task-list-layout').TaskSortBy
  kanbanBoardMode: import('./kanban-config').KanbanBoardMode | null
  /** layout=quadrant 时的展示选项 */
  quadrantOptions: import('./quadrant-layout').QuadrantLayoutOptions | null
  sortOrder: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface CreateTaskViewDto {
  name: string
  layout: TaskViewLayout
  scopeKey?: string | null
  filterRule?: import('./task-filter-ast').FilterNode | null
  groupBy?: import('./task-list-layout').TaskGroupBy
  sortBy?: import('./task-list-layout').TaskSortBy
  kanbanBoardMode?: import('./kanban-config').KanbanBoardMode | null
  quadrantOptions?: import('./quadrant-layout').QuadrantLayoutOptions | null
  sortOrder?: number
}

export interface UpdateTaskViewDto {
  name?: string
  layout?: TaskViewLayout
  scopeKey?: string | null
  filterRule?: import('./task-filter-ast').FilterNode | null
  groupBy?: import('./task-list-layout').TaskGroupBy
  sortBy?: import('./task-list-layout').TaskSortBy
  kanbanBoardMode?: import('./kanban-config').KanbanBoardMode | null
  quadrantOptions?: import('./quadrant-layout').QuadrantLayoutOptions | null
  sortOrder?: number
}

export type TaskActivityType =
  | 'created'
  | 'title_updated'
  | 'description_updated'
  | 'priority_updated'
  | 'category_updated'
  | 'tags_updated'
  | 'due_updated'
  | 'start_updated'
  | 'reminders_updated'
  | 'recurrence_updated'
  | 'kanban_group_updated'
  | 'subtask_added'
  | 'subtask_removed'
  | 'subtask_completed'
  | 'subtask_reopened'
  | 'completed'
  | 'reopened'
  | 'deleted'
  | 'restored'
  | 'permanently_deleted'

export interface TaskActivity {
  id: string
  taskId: string
  type: TaskActivityType
  /** 一句话描述「发生了什么」，不记录字段 diff */
  summary: string
  createdAt: IsoDateTime
}

export type TaskActivityRetentionMode = 'forever' | 'max_count' | 'max_days'

export interface TaskActivityRetentionPolicy {
  mode: TaskActivityRetentionMode
  maxCount?: number
  maxDays?: number
}

export interface Category {
  id: string
  name: string
  color: string | null
  sortOrder: number
  /** 用于任务标题自动归清单；全局不可重复 */
  keywords: string[]
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
  /** 计划开始时间（时间线条带起点）；null 表示未单独设置 */
  startAt: IsoDateTime | null
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
  /**
   * 循环任务已完成的单日日期（YYYY-MM-DD）。
   * 与整条 status 独立：日历某一天点完成只写入此列表。
   */
  completedOccurrenceDates?: string[]
  /** 持续提醒：触发后仍按间隔重复通知直至处理 */
  remindContinuous?: boolean
  /** 任务标签（持久化，可多选） */
  tags?: string[]
  /** 用户已排优（设象限）的时间；null 表示未排优，进收件箱 */
  triagedAt: IsoDateTime | null
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
  startAt?: IsoDateTime | null
  dueAt?: IsoDateTime | null
  remindAt?: IsoDateTime | null
  reminders?: import('./task-reminder').TaskReminderInput[]
  recurrence?: import('./task-reminder').TaskRecurrenceRule | null
  remindContinuous?: boolean
  sortOrder?: number
  kanbanGroupId?: string | null
  tags?: string[]
  /** 显式传入时覆盖默认（快速添加不传，保持 null） */
  triagedAt?: IsoDateTime | null
}

export interface UpdateTaskDto {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: import('./task-priority').TaskPriority
  categoryId?: string | null
  parentId?: string | null
  startAt?: IsoDateTime | null
  dueAt?: IsoDateTime | null
  remindAt?: IsoDateTime | null
  reminders?: import('./task-reminder').TaskReminderInput[]
  recurrence?: import('./task-reminder').TaskRecurrenceRule | null
  /** 覆盖循环单日完成列表；传 [] 清空 */
  completedOccurrenceDates?: string[]
  remindContinuous?: boolean
  sortOrder?: number
  kanbanGroupId?: string | null
  tags?: string[]
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
  keywords?: string[]
}

export interface UpdateCategoryDto {
  name?: string
  color?: string | null
  sortOrder?: number
  keywords?: string[]
}

/** 任务列表筛选：智能列表与侧栏导航共用 */
export type SmartList = 'all' | 'today' | 'week' | 'last7days' | 'done' | 'trash'

export type { TaskDateField, DoneTimeRange, CalendarRangePreset } from './date-filter'
export type { HideDoneScope } from './hide-done-scope'

export interface TaskListFilter {
  smartList?: SmartList
  categoryId?: string | null
  status?: TaskStatus
  /** @deprecated 请使用 hideDoneScope；保留以兼容旧 IPC/存储 */
  hideDone?: boolean
  /** 隐藏已完成范围：off / all / today / week / month */
  hideDoneScope?: import('./hide-done-scope').HideDoneScope
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
  /** 是否已自动复制并清理源目录 */
  migrated?: boolean
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

/** 与 AGENTS.md / 后端约定一致的任务状态枚举 */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

/** 艾森豪威尔四象限优先级 */
export type { TaskPriority } from './task-priority'

/** ISO 本地时间字符串：yyyy-MM-ddTHH:mm:ss */
export type IsoDateTime = string

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
  sortOrder?: number
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
  sortOrder?: number
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
export type SmartList = 'all' | 'today' | 'done'

export interface TaskListFilter {
  smartList?: SmartList
  categoryId?: string | null
  status?: TaskStatus
  hideDone?: boolean
  parentId?: string | null
  search?: string
}

export interface SetDataPathResult {
  /** 新路径已写入 config，需重启后生效 */
  requiresRestart: true
  pendingPath: string
}

export interface AppInfo {
  version: string
  dataPath: string
  writable: boolean
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

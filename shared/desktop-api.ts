import type {
  AppInfo,
  Category,
  CreateCategoryDto,
  CreateTaskDto,
  IpcResult,
  SetDataPathResult,
  Task,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateTaskDto
} from './types'
import type { ShortcutActionId, ShortcutBindings } from './shortcuts'

/**
 * Preload 暴露给渲染进程的 API 形状。
 * 所有方法返回 Promise<IpcResult<T>>，渲染端须检查 ok 字段。
 */
export interface DesktopApi {
  tasks: {
    list(filter?: TaskListFilter): Promise<IpcResult<Task[]>>
    get(id: string): Promise<IpcResult<Task>>
    create(dto: CreateTaskDto): Promise<IpcResult<Task>>
    update(id: string, dto: UpdateTaskDto): Promise<IpcResult<Task>>
    delete(id: string): Promise<IpcResult<void>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
    create(dto: CreateCategoryDto): Promise<IpcResult<Category>>
    update(id: string, dto: UpdateCategoryDto): Promise<IpcResult<Category>>
    delete(id: string): Promise<IpcResult<void>>
  }
  app: {
    getDataPath(): Promise<IpcResult<string>>
    setDataPath(path: string): Promise<IpcResult<SetDataPathResult>>
    getVersion(): Promise<IpcResult<string>>
    getInfo(): Promise<IpcResult<AppInfo>>
    getShortcuts(): Promise<IpcResult<ShortcutBindings>>
    setShortcuts(bindings: ShortcutBindings): Promise<IpcResult<ShortcutBindings>>
    showWindow(): Promise<IpcResult<void>>
    /** @deprecated 请使用 onAction('newTask') */
    onNewTask(callback: () => void): () => void
    onAction(callback: (action: ShortcutActionId) => void): () => void
  }
}

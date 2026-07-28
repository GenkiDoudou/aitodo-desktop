import type {
  Category,
  IpcResult,
  Task,
  TaskListFilter,
  TaskView,
  UpdateTaskDto
} from '@shared/types'
import type {
  ConvertWidgetNoteToTaskDto,
  CreateWidgetNoteDto,
  UpdateWidgetInstanceDto,
  UpdateWidgetNoteDto,
  WidgetInstance,
  WidgetNote
} from '@shared/widget-notes'
import type { WidgetDisplayMode } from '@shared/widget-display'

/** 挂件窗口 preload 暴露的 API 子集 */
export interface WidgetApi {
  widget: {
    getInstance(id: string): Promise<IpcResult<WidgetInstance>>
    updateInstance(id: string, dto: UpdateWidgetInstanceDto): Promise<IpcResult<WidgetInstance>>
    hide(id: string): Promise<IpcResult<void>>
    expand(id: string, options?: { peek?: boolean }): Promise<IpcResult<void>>
    collapse(id: string): Promise<IpcResult<void>>
    onDisplayModeChanged(callback: (instance: WidgetInstance) => void): () => void
  }
  widgetNotes: {
    list(): Promise<IpcResult<WidgetNote[]>>
    create(dto?: CreateWidgetNoteDto): Promise<IpcResult<WidgetNote>>
    update(id: string, dto: UpdateWidgetNoteDto): Promise<IpcResult<WidgetNote>>
    delete(id: string): Promise<IpcResult<void>>
    convertToTask(id: string, dto: ConvertWidgetNoteToTaskDto): Promise<IpcResult<Task>>
  }
  tasks: {
    list(filter?: TaskListFilter): Promise<IpcResult<Task[]>>
    update(id: string, dto: UpdateTaskDto): Promise<IpcResult<Task>>
  }
  taskViews: {
    list(): Promise<IpcResult<TaskView[]>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
  }
  kanbanGroups: {
    list(scopeKey: string): Promise<IpcResult<import('@shared/types').KanbanBoardGroupsResult>>
  }
  app: {
    openMain(route?: string): Promise<IpcResult<void>>
  }
}

declare global {
  interface Window {
    widgetApi: WidgetApi
  }
}

export {}

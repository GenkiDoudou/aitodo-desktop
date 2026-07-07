import type {
  AppInfo,
  AppMessage,
  AppMessageKind,
  AppMessageSource,
  Category,
  CreateCategoryDto,
  CreateKanbanGroupDto,
  CreateScheduledSummaryDto,
  CreateTaskDto,
  DeleteTaskOptions,
  IpcResult,
  KanbanBoardGroupsResult,
  KanbanGroup,
  SetDataPathResult,
  ScheduledSummary,
  Task,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateKanbanGroupDto,
  UpdateScheduledSummaryDto,
  UpdateTaskDto
} from './types'
import type { ShortcutActionId, ShortcutBindings } from './shortcuts'
import type { LlmConfig } from './llm-config'
import type { AiPromptConfig } from './ai-prompt-config'
import type { UserConfigImportResult } from '@shared/user-config-export'

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
    delete(id: string, options?: DeleteTaskOptions): Promise<IpcResult<void>>
    /** 从垃圾桶恢复（若父任务仍在垃圾桶则一并恢复） */
    restore(id: string): Promise<IpcResult<Task>>
    /** 彻底删除（仅适用于已在垃圾桶中的任务） */
    permanentDelete(id: string, options?: DeleteTaskOptions): Promise<IpcResult<void>>
    emptyTrash(): Promise<IpcResult<number>>
    countTrash(): Promise<IpcResult<number>>
    countDone(): Promise<IpcResult<number>>
    /** 读取垃圾桶中的任务详情 */
    getInTrash(id: string): Promise<IpcResult<Task>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
    create(dto: CreateCategoryDto): Promise<IpcResult<Category>>
    update(id: string, dto: UpdateCategoryDto): Promise<IpcResult<Category>>
    delete(id: string): Promise<IpcResult<void>>
  }
  kanbanGroups: {
    list(scopeKey: string): Promise<IpcResult<KanbanBoardGroupsResult>>
    create(dto: CreateKanbanGroupDto): Promise<IpcResult<KanbanGroup>>
    update(id: string, dto: UpdateKanbanGroupDto): Promise<IpcResult<KanbanGroup>>
    delete(id: string): Promise<IpcResult<void>>
  }
  messages: {
    list(kind?: AppMessageKind, source?: AppMessageSource): Promise<IpcResult<AppMessage[]>>
    countUnread(kind?: AppMessageKind): Promise<IpcResult<number>>
    markRead(id: string): Promise<IpcResult<AppMessage>>
    markAllRead(kind?: AppMessageKind): Promise<IpcResult<number>>
  }
  scheduledSummaries: {
    list(): Promise<IpcResult<ScheduledSummary[]>>
    create(dto: CreateScheduledSummaryDto): Promise<IpcResult<ScheduledSummary>>
    update(id: string, dto: UpdateScheduledSummaryDto): Promise<IpcResult<ScheduledSummary>>
    delete(id: string): Promise<IpcResult<void>>
  }
  app: {
    getDataPath(): Promise<IpcResult<string>>
    setDataPath(path: string): Promise<IpcResult<SetDataPathResult>>
    pickDataDir(): Promise<IpcResult<string | null>>
    exportUserConfig(uiPreferences?: Record<string, string>): Promise<IpcResult<string | null>>
    importUserConfig(): Promise<IpcResult<UserConfigImportResult | null>>
    getVersion(): Promise<IpcResult<string>>
    getInfo(): Promise<IpcResult<AppInfo>>
    getShortcuts(): Promise<IpcResult<ShortcutBindings>>
    setShortcuts(bindings: ShortcutBindings): Promise<IpcResult<ShortcutBindings>>
    getLlmConfig(): Promise<IpcResult<LlmConfig>>
    setLlmConfig(config: LlmConfig): Promise<IpcResult<LlmConfig>>
    getAiPrompt(): Promise<IpcResult<AiPromptConfig>>
    setAiPrompt(config: AiPromptConfig): Promise<IpcResult<AiPromptConfig>>
    showWindow(): Promise<IpcResult<void>>
    pickAttachment(): Promise<IpcResult<SavedAttachment | null>>
    saveAttachment(dto: { name: string; base64: string }): Promise<IpcResult<SavedAttachment>>
    resolveAttachmentUrl(uri: string): Promise<IpcResult<string | null>>
    openAttachment(uri: string): Promise<IpcResult<void>>
    downloadAttachment(uri: string, suggestedName?: string): Promise<IpcResult<boolean>>
    /** @deprecated 请使用 onAction('newTask') */
    onNewTask(callback: () => void): () => void
    onAction(callback: (action: ShortcutActionId) => void): () => void
    /** 主进程推送新消息（任务提醒等） */
    onMessagePush(callback: (message: AppMessage) => void): () => void
  }
}

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
  CreateTaskViewDto,
  DeleteTaskOptions,
  IpcResult,
  KanbanBoardGroupsResult,
  KanbanGroup,
  SetDataPathResult,
  ScheduledSummary,
  Task,
  TaskView,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateKanbanGroupDto,
  UpdateScheduledSummaryDto,
  UpdateTaskDto,
  UpdateTaskViewDto,
  TaskActivity,
  TaskActivityRetentionPolicy
} from './types'
import type { ShortcutActionId, ShortcutBindings } from './shortcuts'
import type { LlmConfig } from './llm-config'
import type { AiPromptConfig } from './ai-prompt-config'
import type { CloseBehavior, ConfirmClosePayload } from './close-behavior'
import type { UserConfigImportResult } from '@shared/user-config-export'
import type { HolidayCalendarDay, HolidayCacheStatus } from '@shared/timor-holiday'
import type { FilterNode } from '@shared/task-filter-ast'
import type {
  CreateDesktopCategoryDto,
  DesktopCategory,
  DesktopOrganizeExecuteResult,
  DesktopOrganizePlan,
  DesktopOrganizeSettings,
  DesktopScanItem,
  UpdateDesktopCategoryDto,
  UpdateDesktopOrganizeSettingsDto
} from './desktop-organize-types'
import type { UpdateWidgetSettingsDto, WidgetSettings, WidgetNote, CreateWidgetNoteDto, UpdateWidgetNoteDto, ConvertWidgetNoteToTaskDto } from './widget-notes'
import type {
  DesktopFenceLayout,
  DesktopFenceSettings,
  UpdateDesktopFenceLayoutDto,
  UpdateDesktopFenceSettingsDto
} from './fence-types'

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
  tags: {
    list(): Promise<IpcResult<string[]>>
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
    /** 生成预览正文，无发送副作用 */
    preview(dto: Partial<ScheduledSummary> & CreateScheduledSummaryDto): Promise<IpcResult<string>>
    /** 立即生成并发送汇总（消息 + 通知） */
    runNow(id: string): Promise<IpcResult<ScheduledSummary>>
  }
  holidays: {
    /** 返回多年日历标注；key 为 YYYY-MM-DD */
    calendarMarks(years: number[]): Promise<IpcResult<Record<string, HolidayCalendarDay>>>
    /** 节假日缓存状态 */
    status(): Promise<IpcResult<HolidayCacheStatus>>
    /** 强制刷新指定年份，返回新 marks + status */
    refresh(
      years: number[]
    ): Promise<IpcResult<{ marks: Record<string, HolidayCalendarDay>; status: HolidayCacheStatus }>>
  }
  taskViews: {
    list(): Promise<IpcResult<TaskView[]>>
    create(dto: CreateTaskViewDto): Promise<IpcResult<TaskView>>
    update(id: string, dto: UpdateTaskViewDto): Promise<IpcResult<TaskView>>
    delete(id: string): Promise<IpcResult<void>>
    previewCount(rule: FilterNode): Promise<IpcResult<number>>
    createFromTemplate(
      templateId: import('./view-templates').ViewTemplateId
    ): Promise<IpcResult<TaskView>>
  }
  taskActivities: {
    listByTask(taskId: string, limit?: number, before?: string): Promise<IpcResult<TaskActivity[]>>
    count(): Promise<IpcResult<number>>
    deleteAll(): Promise<IpcResult<number>>
    purge(): Promise<IpcResult<number>>
    deleteTrashed(): Promise<IpcResult<number>>
    getRetention(): Promise<IpcResult<TaskActivityRetentionPolicy>>
    setRetention(policy: TaskActivityRetentionPolicy): Promise<IpcResult<TaskActivityRetentionPolicy>>
  }
  desktopOrganize: {
    scan(): Promise<IpcResult<DesktopScanItem[]>>
    preview(): Promise<IpcResult<DesktopOrganizePlan>>
    execute(plan?: DesktopOrganizePlan): Promise<IpcResult<DesktopOrganizeExecuteResult>>
    undo(): Promise<IpcResult<{ restored: number; skipped: Array<{ path: string; reason: string }> }>>
    canUndo(): Promise<IpcResult<boolean>>
    getSettings(): Promise<IpcResult<DesktopOrganizeSettings>>
    updateSettings(dto: UpdateDesktopOrganizeSettingsDto): Promise<IpcResult<DesktopOrganizeSettings>>
    listCategories(): Promise<IpcResult<DesktopCategory[]>>
    createCategory(dto: CreateDesktopCategoryDto): Promise<IpcResult<DesktopCategory>>
    updateCategory(id: string, dto: UpdateDesktopCategoryDto): Promise<IpcResult<DesktopCategory>>
    deleteCategory(id: string): Promise<IpcResult<void>>
    reorderCategories(orderedIds: string[]): Promise<IpcResult<DesktopCategory[]>>
    setManualAssignment(itemPath: string, categoryId: string): Promise<IpcResult<void>>
    removeManualAssignment(itemPath: string): Promise<IpcResult<void>>
    getDesktopPath(): Promise<IpcResult<string>>
    openDesktop(): Promise<IpcResult<void>>
    listCustomRules(): Promise<IpcResult<import('./desktop-organize-types').DesktopCustomRule[]>>
    createCustomRule(
      dto: import('./desktop-organize-types').CreateDesktopCustomRuleDto
    ): Promise<IpcResult<import('./desktop-organize-types').DesktopCustomRule>>
    updateCustomRule(
      id: string,
      dto: import('./desktop-organize-types').UpdateDesktopCustomRuleDto
    ): Promise<IpcResult<import('./desktop-organize-types').DesktopCustomRule>>
    deleteCustomRule(id: string): Promise<IpcResult<void>>
    listDefaultRules(): Promise<IpcResult<import('./desktop-organize-types').DesktopDefaultRuleRow[]>>
    setDefaultRuleEnabled(categoryId: string, enabled: boolean): Promise<IpcResult<DesktopCategory>>
  }
  widget: {
    toggle(): Promise<IpcResult<void>>
    show(): Promise<IpcResult<void>>
    getSettings(): Promise<IpcResult<WidgetSettings>>
    updateSettings(dto: UpdateWidgetSettingsDto): Promise<IpcResult<WidgetSettings>>
  }
  widgetInstances: {
    list(): Promise<IpcResult<import('./widget-notes').WidgetInstance[]>>
    get(id: string): Promise<IpcResult<import('./widget-notes').WidgetInstance>>
    create(dto: import('./widget-notes').CreateWidgetInstanceDto): Promise<IpcResult<import('./widget-notes').WidgetInstance>>
    update(id: string, dto: import('./widget-notes').UpdateWidgetInstanceDto): Promise<IpcResult<import('./widget-notes').WidgetInstance>>
    delete(id: string): Promise<IpcResult<void>>
    show(id: string): Promise<IpcResult<void>>
    hide(id: string): Promise<IpcResult<void>>
    toggle(id: string): Promise<IpcResult<void>>
  }
  capture: {
    toggle(): Promise<IpcResult<void>>
    show(): Promise<IpcResult<void>>
    hide(): Promise<IpcResult<void>>
  }
  widgetNotes: {
    list(): Promise<IpcResult<WidgetNote[]>>
    create(dto?: CreateWidgetNoteDto): Promise<IpcResult<WidgetNote>>
    update(id: string, dto: UpdateWidgetNoteDto): Promise<IpcResult<WidgetNote>>
    delete(id: string): Promise<IpcResult<void>>
    convertToTask(id: string, dto: ConvertWidgetNoteToTaskDto): Promise<IpcResult<Task>>
  }
  fence: {
    getSettings(): Promise<IpcResult<DesktopFenceSettings>>
    updateSettings(dto: UpdateDesktopFenceSettingsDto): Promise<IpcResult<DesktopFenceSettings>>
    showAll(): Promise<IpcResult<void>>
    hideAll(): Promise<IpcResult<void>>
    listLayouts(): Promise<IpcResult<DesktopFenceLayout[]>>
    updateLayout(categoryId: string, dto: UpdateDesktopFenceLayoutDto): Promise<IpcResult<DesktopFenceLayout>>
    recoverDesktopIcons(): Promise<IpcResult<void>>
    getWallpaper(): Promise<IpcResult<import('./fence-types').DesktopWallpaperState>>
    pickWallpaper(): Promise<IpcResult<{ path: string; previewDataUrl: string | null } | null>>
    applyWallpaper(sourcePath: string): Promise<IpcResult<import('./fence-types').DesktopWallpaperState>>
    restoreWallpaper(): Promise<IpcResult<import('./fence-types').DesktopWallpaperState>>
    listWallpaperPresets(): Promise<IpcResult<import('./fence-types').WallpaperPreset[]>>
    applyWallpaperPreset(presetId: string): Promise<IpcResult<import('./fence-types').DesktopWallpaperState>>
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
    getCloseBehavior(): Promise<IpcResult<CloseBehavior>>
    setCloseBehavior(behavior: CloseBehavior): Promise<IpcResult<CloseBehavior>>
    confirmClose(payload: ConfirmClosePayload): Promise<IpcResult<void>>
    showWindow(): Promise<IpcResult<void>>
    openMain(route?: string): Promise<IpcResult<void>>
    pickAttachment(): Promise<IpcResult<SavedAttachment | null>>
    saveAttachment(dto: { name: string; base64: string }): Promise<IpcResult<SavedAttachment>>
    resolveAttachmentUrl(uri: string): Promise<IpcResult<string | null>>
    openAttachment(uri: string): Promise<IpcResult<void>>
    downloadAttachment(uri: string, suggestedName?: string): Promise<IpcResult<boolean>>
    /** @deprecated 请使用 onAction('newTask') */
    onNewTask(callback: () => void): () => void
    onAction(callback: (action: ShortcutActionId) => void): () => void
    /** 主进程请求渲染进程展示关闭确认对话框 */
    onCloseRequest(callback: () => void): () => void
    /** 主进程推送新消息（任务提醒等） */
    onMessagePush(callback: (message: AppMessage) => void): () => void
    /** 主进程请求导航（如挂件打开完整整理页） */
    onNavigate(callback: (route: string) => void): () => void
  }
}

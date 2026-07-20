import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  CreateCategoryDto,
  CreateKanbanGroupDto,
  CreateScheduledSummaryDto,
  CreateTaskDto,
  CreateTaskViewDto,
  ScheduledSummary,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateKanbanGroupDto,
  UpdateScheduledSummaryDto,
  UpdateTaskDto,
  UpdateTaskViewDto,
  AppMessage,
  AppMessageKind,
  AppMessageSource,
  TaskActivityRetentionPolicy
} from '@shared/types'
import type { ViewTemplateId } from '@shared/view-templates'
import { getViewTemplate } from '@shared/view-templates'
import { getActiveDataDir, getDatabase } from '../db/database'
import { CategoryRepository } from '../db/category-repository'
import { KanbanGroupRepository } from '../db/kanban-group-repository'
import { AppMessageRepository } from '../db/app-message-repository'
import { TaskReminderRepository } from '../db/task-reminder-repository'
import { TaskRepository } from '../db/task-repository'
import { TagRepository } from '../db/tag-repository'
import { TaskViewRepository } from '../db/task-view-repository'
import { TaskActivityRepository } from '../db/task-activity-repository'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { CategoryService } from '../services/category-service'
import { AppMessageService } from '../services/app-message-service'
import { KanbanGroupService } from '../services/kanban-group-service'
import { TaskService } from '../services/task-service'
import { TaskViewService } from '../services/task-view-service'
import { TaskActivityService } from '../services/task-activity-service'
import { TaskActivityRecorder } from '../services/task-activity-recorder'
import { ScheduledSummaryService } from '../services/scheduled-summary-service'
import type { SummarySchedulerService } from '../services/summary-scheduler-service'
import {
  getDefaultDataDir,
  isDirectoryWritable,
  readShortcutBindings,
  resolveDataDir,
  readLlmConfig,
  readAiPromptConfig,
  readCloseBehavior,
  saveLlmConfig,
  saveAiPromptConfig,
  saveCloseBehavior,
  savePendingDataDir,
  saveShortcutBindings
} from '../data-path'
import { registerGlobalShortcuts, createDefaultShortcutHandlers } from '../shortcuts'
import type { ShortcutBindings } from '@shared/shortcuts'
import { findShortcutConflicts, formatShortcutConflictMessage, mergeShortcutBindings } from '@shared/shortcuts'
import type { LlmConfig } from '@shared/llm-config'
import type { AiPromptConfig } from '@shared/ai-prompt-config'
import type { CloseBehavior, ConfirmClosePayload } from '@shared/close-behavior'
import { AppError } from '@shared/types'
import { wrapIpc, wrapIpcAsync } from './wrap'
import { cloneTaskListFilter } from '@shared/task-list-filter'
import {
  openAttachmentPath,
  openAttachmentUriOrFileUrl,
  pickAndSaveAttachment,
  resolveAttachmentFileUrl,
  saveAttachmentBuffer,
  downloadAttachment
} from '../services/attachment-service'
import {
  exportUserConfigToFile,
  importUserConfigFromFile
} from '../services/user-config-service'
import type { HolidayService } from '../services/holiday-service'
import type { UpdateWidgetSettingsDto } from '@shared/widget-notes'
import { WidgetNoteRepository } from '../db/widget-note-repository'
import { WidgetNoteService } from '../services/widget-note-service'
import { getWidgetWindowManager } from '../widget-window-manager'
import { getQuickCaptureWindowManager } from '../quick-capture-window-manager'
import { markQuitting, toggleMainWindow } from '../tray'
import { showSystemNotification } from '../services/system-notification'

function services() {
  const db = getDatabase()
  const taskRepo = new TaskRepository(db)
  const tagRepo = new TagRepository(db)
  const categoryRepo = new CategoryRepository(db)
  const kanbanRepo = new KanbanGroupRepository(db)
  const messageRepo = new AppMessageRepository(db)
  const reminderRepo = new TaskReminderRepository(db)
  const summaryRepo = new ScheduledSummaryRepository(db)
  const viewRepo = new TaskViewRepository(db)
  const activityRepo = new TaskActivityRepository(db)
  const activityService = new TaskActivityService(activityRepo)
  const activityRecorder = new TaskActivityRecorder(categoryRepo, kanbanRepo)
  const widgetNoteRepo = new WidgetNoteRepository(db)
  const taskService = new TaskService(taskRepo, reminderRepo, tagRepo, activityService, activityRecorder)
  return {
    tasks: taskService,
    tags: tagRepo,
    categories: new CategoryService(categoryRepo),
    kanbanGroups: new KanbanGroupService(kanbanRepo),
    messages: new AppMessageService(messageRepo),
    scheduledSummaries: new ScheduledSummaryService(summaryRepo, taskRepo, categoryRepo),
    taskViews: new TaskViewService(viewRepo, taskRepo),
    taskActivities: activityService,
    widgetNotes: new WidgetNoteService(widgetNoteRepo, taskService, categoryRepo),
    widgetSettings: widgetNoteRepo
  }
}

let getMainWindowRef: () => BrowserWindow | null = () => null

/** 主进程写入消息后推送给渲染进程（侧栏角标与列表刷新） */
export function pushAppMessageToRenderer(message: AppMessage): void {
  getMainWindowRef()?.webContents.send(IPC.APP_MESSAGE_PUSH, message)
  if (message.kind !== 'notification') return
  const body = (message.body ?? message.title).trim()
  if (message.source === 'task_reminder') {
    showSystemNotification('任务提醒', body)
  } else if (message.source === 'scheduled_summary') {
    const title = message.title.replace(/^定时汇总：/, '').trim() || '定时汇总'
    showSystemNotification(title, body.slice(0, 240))
  }
}

/** 由 index 注入，供「立即生成」复用调度器发送链路 */
let summarySchedulerRef: SummarySchedulerService | null = null

export function setSummarySchedulerService(scheduler: SummarySchedulerService | null): void {
  summarySchedulerRef = scheduler
}

let holidayServiceRef: HolidayService | null = null

export function setHolidayService(service: HolidayService | null): void {
  holidayServiceRef = service
}

/** 注册全部 IPC handler；在 app.whenReady 且数据库可用后调用 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  getMainWindowRef = getMainWindow
  ipcMain.handle(IPC.TASKS_LIST, (_e, filter?: TaskListFilter) =>
    wrapIpc(() => services().tasks.list(cloneTaskListFilter(filter ?? {})))
  )
  ipcMain.handle(IPC.TASKS_GET, (_e, id: string) => wrapIpc(() => services().tasks.get(id)))
  ipcMain.handle(IPC.TASKS_GET_IN_TRASH, (_e, id: string) =>
    wrapIpc(() => services().tasks.getInTrash(id))
  )
  ipcMain.handle(IPC.TASKS_CREATE, (_e, dto: CreateTaskDto) =>
    wrapIpc(() => services().tasks.create(dto))
  )
  ipcMain.handle(IPC.TASKS_UPDATE, (_e, id: string, dto: UpdateTaskDto) =>
    wrapIpc(() => services().tasks.update(id, dto))
  )
  ipcMain.handle(IPC.TASKS_DELETE, (_e, id: string, options?: import('@shared/types').DeleteTaskOptions) =>
    wrapIpc(() => {
      services().tasks.delete(id, options)
      return undefined
    })
  )
  ipcMain.handle(IPC.TASKS_RESTORE, (_e, id: string) => wrapIpc(() => services().tasks.restore(id)))
  ipcMain.handle(IPC.TASKS_PERMANENT_DELETE, (_e, id: string, options?: import('@shared/types').DeleteTaskOptions) =>
    wrapIpc(() => {
      services().tasks.permanentDelete(id, options)
      return undefined
    })
  )
  ipcMain.handle(IPC.TASKS_EMPTY_TRASH, () => wrapIpc(() => services().tasks.emptyTrash()))
  ipcMain.handle(IPC.TASKS_COUNT_TRASH, () => wrapIpc(() => services().tasks.countTrash()))
  ipcMain.handle(IPC.TASKS_COUNT_DONE, () => wrapIpc(() => services().tasks.countDone()))

  ipcMain.handle(IPC.KANBAN_GROUPS_LIST, (_e, scopeKey: string) =>
    wrapIpc(() => services().kanbanGroups.listBoard(scopeKey))
  )
  ipcMain.handle(IPC.KANBAN_GROUPS_CREATE, (_e, dto: CreateKanbanGroupDto) =>
    wrapIpc(() => services().kanbanGroups.create(dto))
  )
  ipcMain.handle(IPC.KANBAN_GROUPS_UPDATE, (_e, id: string, dto: UpdateKanbanGroupDto) =>
    wrapIpc(() => services().kanbanGroups.update(id, dto))
  )
  ipcMain.handle(IPC.KANBAN_GROUPS_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().kanbanGroups.delete(id)
      return undefined
    })
  )

  ipcMain.handle(
    IPC.MESSAGES_LIST,
    (_e, kind?: AppMessageKind, source?: AppMessageSource) =>
      wrapIpc(() => services().messages.list(kind, source))
  )
  ipcMain.handle(IPC.MESSAGES_COUNT_UNREAD, (_e, kind?: AppMessageKind) =>
    wrapIpc(() => services().messages.countUnread(kind))
  )
  ipcMain.handle(IPC.MESSAGES_MARK_READ, (_e, id: string) =>
    wrapIpc(() => services().messages.markRead(id))
  )
  ipcMain.handle(IPC.MESSAGES_MARK_ALL_READ, (_e, kind?: AppMessageKind) =>
    wrapIpc(() => services().messages.markAllRead(kind))
  )

  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_LIST, () =>
    wrapIpc(() => services().scheduledSummaries.list())
  )
  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_CREATE, (_e, dto: CreateScheduledSummaryDto) =>
    wrapIpc(() => services().scheduledSummaries.create(dto))
  )
  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_UPDATE, (_e, id: string, dto: UpdateScheduledSummaryDto) =>
    wrapIpc(() => services().scheduledSummaries.update(id, dto))
  )
  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().scheduledSummaries.delete(id)
      return undefined
    })
  )
  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_PREVIEW, (_e, dto: Partial<ScheduledSummary> & CreateScheduledSummaryDto) =>
    wrapIpcAsync(() => services().scheduledSummaries.previewSummaryBody(dto))
  )
  ipcMain.handle(IPC.SCHEDULED_SUMMARIES_RUN_NOW, (_e, id: string) =>
    wrapIpcAsync(async () => {
      if (!summarySchedulerRef) {
        throw new AppError('INTERNAL_ERROR', '汇总调度器尚未就绪，请稍后重试')
      }
      return summarySchedulerRef.runNow(id)
    })
  )

  ipcMain.handle(IPC.CATEGORIES_LIST, () => wrapIpc(() => services().categories.list()))
  ipcMain.handle(IPC.CATEGORIES_CREATE, (_e, dto: CreateCategoryDto) =>
    wrapIpc(() => services().categories.create(dto))
  )
  ipcMain.handle(IPC.CATEGORIES_UPDATE, (_e, id: string, dto: UpdateCategoryDto) =>
    wrapIpc(() => services().categories.update(id, dto))
  )
  ipcMain.handle(IPC.CATEGORIES_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().categories.delete(id)
      return undefined
    })
  )

  ipcMain.handle(IPC.TAGS_LIST, () => wrapIpc(() => services().tags.listAllNames()))

  ipcMain.handle(IPC.APP_GET_DATA_PATH, () => wrapIpc(() => getActiveDataDir()))
  ipcMain.handle(IPC.APP_SET_DATA_PATH, (_e, newPath: string) =>
    wrapIpc(() => {
      savePendingDataDir(getDefaultDataDir(), newPath)
      return { requiresRestart: true as const, pendingPath: newPath }
    })
  )
  ipcMain.handle(IPC.APP_GET_VERSION, () => wrapIpc(() => app.getVersion()))
  ipcMain.handle(IPC.APP_GET_INFO, () =>
    wrapIpc(() => {
      const dataPath = getActiveDataDir()
      return {
        version: app.getVersion(),
        dataPath,
        defaultDataPath: getDefaultDataDir(),
        writable: isDirectoryWritable(dataPath)
      }
    })
  )

  ipcMain.handle(IPC.APP_PICK_DATA_DIR, async () =>
    wrapIpcAsync(async () => {
      const win = getMainWindow()
      const result =
        win && !win.isDestroyed()
          ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
          : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
      if (result.canceled || !result.filePaths[0]) {
        return null
      }
      return result.filePaths[0]
    })
  )

  ipcMain.handle(IPC.APP_EXPORT_USER_CONFIG, async (_e, uiPreferences?: Record<string, string>) =>
    wrapIpcAsync(() => exportUserConfigToFile(getMainWindow() ?? undefined, uiPreferences))
  )

  ipcMain.handle(IPC.APP_IMPORT_USER_CONFIG, async () =>
    wrapIpcAsync(async () => {
      const result = await importUserConfigFromFile(getMainWindow() ?? undefined)
      if (!result) return null
      const win = getMainWindow()
      if (win && result.applied.shortcuts) {
        registerGlobalShortcuts(
          win,
          createDefaultShortcutHandlers(getMainWindow),
          mergeShortcutBindings(result.applied.shortcuts)
        )
      }
      return result
    })
  )

  ipcMain.handle(IPC.APP_GET_SHORTCUTS, () => wrapIpc(() => readShortcutBindings()))

  ipcMain.handle(IPC.APP_SET_SHORTCUTS, (_e, bindings: ShortcutBindings) =>
    wrapIpc(() => {
      const conflicts = findShortcutConflicts(bindings)
      if (conflicts.size > 0) {
        const first = [...conflicts.entries()][0]
        const [accel, ids] = first
        throw new AppError(
          'SHORTCUT_CONFLICT',
          formatShortcutConflictMessage(accel, ids)
        )
      }
      saveShortcutBindings(bindings)
      const win = getMainWindow()
      if (win) {
        registerGlobalShortcuts(win, createDefaultShortcutHandlers(getMainWindow), bindings)
      }
      return bindings
    })
  )

  ipcMain.handle(IPC.APP_GET_LLM_CONFIG, () => wrapIpc(() => readLlmConfig()))

  ipcMain.handle(IPC.APP_SET_LLM_CONFIG, (_e, config: LlmConfig) =>
    wrapIpc(() => {
      saveLlmConfig(config)
      return readLlmConfig()
    })
  )

  ipcMain.handle(IPC.APP_GET_AI_PROMPT, () => wrapIpc(() => readAiPromptConfig()))

  ipcMain.handle(IPC.APP_SET_AI_PROMPT, (_e, config: AiPromptConfig) =>
    wrapIpc(() => {
      saveAiPromptConfig(config)
      return readAiPromptConfig()
    })
  )

  ipcMain.handle(IPC.APP_GET_CLOSE_BEHAVIOR, () => wrapIpc(() => readCloseBehavior()))

  ipcMain.handle(IPC.APP_SET_CLOSE_BEHAVIOR, (_e, behavior: CloseBehavior) =>
    wrapIpc(() => {
      saveCloseBehavior(behavior)
      return readCloseBehavior()
    })
  )

  ipcMain.handle(IPC.APP_CONFIRM_CLOSE, (_e, payload: ConfirmClosePayload) =>
    wrapIpc(() => {
      if (payload?.behavior !== 'tray' && payload?.behavior !== 'quit') {
        throw new AppError('VALIDATION_ERROR', '未知关闭行为')
      }
      if (payload.remember) {
        saveCloseBehavior(payload.behavior)
      }

      const win = getMainWindow()
      if (payload.behavior === 'tray') {
        win?.hide()
        return undefined
      }

      markQuitting()
      app.quit()
      return undefined
    })
  )

  ipcMain.handle(IPC.APP_SHOW_WINDOW, () =>
    wrapIpc(() => {
      toggleMainWindow(getMainWindow())
    })
  )

  ipcMain.handle(IPC.APP_PICK_ATTACHMENT, async () =>
    wrapIpcAsync(() => pickAndSaveAttachment(getMainWindow() ?? undefined))
  )

  ipcMain.handle(IPC.APP_SAVE_ATTACHMENT, (_e, dto: { name: string; base64: string }) =>
    wrapIpc(() => saveAttachmentBuffer(dto.name, Buffer.from(dto.base64, 'base64')))
  )

  ipcMain.handle(IPC.APP_RESOLVE_ATTACHMENT_URL, (_e, uri: string) =>
    wrapIpc(() => resolveAttachmentFileUrl(uri))
  )

  ipcMain.handle(IPC.APP_OPEN_ATTACHMENT, (_e, uri: string) =>
    wrapIpc(() => {
      openAttachmentUriOrFileUrl(uri)
      return undefined
    })
  )

  ipcMain.handle(IPC.APP_DOWNLOAD_ATTACHMENT, async (_e, uri: string, suggestedName?: string) =>
    wrapIpcAsync(() => downloadAttachment(getMainWindow() ?? undefined, uri, suggestedName))
  )

  ipcMain.handle(IPC.HOLIDAYS_CALENDAR_MARKS, async (_e, years: number[]) =>
    wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError('INTERNAL', '节假日服务未初始化')
      }
      const list = Array.isArray(years)
        ? years.filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100)
        : []
      return holidayServiceRef.getCalendarMarks(list)
    })
  )

  ipcMain.handle(IPC.HOLIDAYS_STATUS, async () =>
    wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError('INTERNAL', '节假日服务未初始化')
      }
      return holidayServiceRef.getStatus()
    })
  )

  ipcMain.handle(IPC.HOLIDAYS_REFRESH, async (_e, years: number[]) =>
    wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError('INTERNAL', '节假日服务未初始化')
      }
      const list = Array.isArray(years)
        ? years.filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100)
        : []
      return holidayServiceRef.refreshYears(list)
    })
  )

  ipcMain.handle(IPC.TASK_VIEWS_LIST, () => wrapIpc(() => services().taskViews.list()))
  ipcMain.handle(IPC.TASK_VIEWS_CREATE, (_e, dto: CreateTaskViewDto) =>
    wrapIpc(() => services().taskViews.create(dto))
  )
  ipcMain.handle(IPC.TASK_VIEWS_UPDATE, (_e, id: string, dto: UpdateTaskViewDto) =>
    wrapIpc(() => services().taskViews.update(id, dto))
  )
  ipcMain.handle(IPC.TASK_VIEWS_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().taskViews.delete(id)
    })
  )
  ipcMain.handle(IPC.TASK_VIEWS_PREVIEW_COUNT, (_e, rule: import('@shared/task-filter-ast').FilterNode) =>
    wrapIpc(() => services().taskViews.previewCount(rule))
  )
  ipcMain.handle(IPC.TASK_VIEWS_CREATE_FROM_TEMPLATE, (_e, templateId: ViewTemplateId) =>
    wrapIpc(() => {
      const tpl = getViewTemplate(templateId)
      if (!tpl) throw new AppError('VALIDATION_ERROR', '未知模板')
      const created = services().taskViews.createFromPreset(tpl.preset, tpl.preset.name)
      if (!created) throw new AppError('VALIDATION_ERROR', '无法添加视图')
      return created
    })
  )

  ipcMain.handle(IPC.TASK_ACTIVITIES_LIST_BY_TASK, (_e, taskId: string, limit?: number, before?: string) =>
    wrapIpc(() => services().taskActivities.listByTask(taskId, limit, before))
  )
  ipcMain.handle(IPC.TASK_ACTIVITIES_COUNT, () =>
    wrapIpc(() => services().taskActivities.countAll())
  )
  ipcMain.handle(IPC.TASK_ACTIVITIES_DELETE_ALL, () =>
    wrapIpc(() => services().taskActivities.deleteAll())
  )
  ipcMain.handle(IPC.TASK_ACTIVITIES_PURGE, () =>
    wrapIpc(() => services().taskActivities.purgeByCurrentPolicy())
  )
  ipcMain.handle(IPC.TASK_ACTIVITIES_DELETE_TRASHED, () =>
    wrapIpc(() => services().taskActivities.deleteForTrashedTasks())
  )
  ipcMain.handle(IPC.TASK_ACTIVITY_RETENTION_GET, () =>
    wrapIpc(() => services().taskActivities.getRetentionPolicy())
  )
  ipcMain.handle(IPC.TASK_ACTIVITY_RETENTION_SET, (_e, policy: TaskActivityRetentionPolicy) =>
    wrapIpc(() => services().taskActivities.updateRetentionPolicy(policy))
  )

  const widgetManager = () => getWidgetWindowManager()

  ipcMain.handle(IPC.WIDGET_TOGGLE, () =>
    wrapIpc(() => {
      widgetManager().toggle()
    })
  )
  ipcMain.handle(IPC.WIDGET_SHOW, () =>
    wrapIpc(() => {
      widgetManager().show()
    })
  )
  ipcMain.handle(IPC.WIDGET_HIDE, () =>
    wrapIpc(() => {
      widgetManager().hide()
    })
  )

  ipcMain.handle(IPC.WIDGET_INSTANCES_LIST, () => wrapIpc(() => widgetManager().listInstances()))
  ipcMain.handle(IPC.WIDGET_INSTANCES_GET, (_e, id: string) =>
    wrapIpc(() => {
      const instance = widgetManager().getInstance(id)
      if (!instance) {
        throw new AppError('NOT_FOUND', '挂件不存在')
      }
      return instance
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCES_CREATE, (_e, dto: import('@shared/widget-notes').CreateWidgetInstanceDto) =>
    wrapIpc(() => widgetManager().createInstance(dto))
  )
  ipcMain.handle(IPC.WIDGET_INSTANCES_UPDATE, (_e, id: string, dto: import('@shared/widget-notes').UpdateWidgetInstanceDto) =>
    wrapIpc(() => widgetManager().updateInstance(id, dto))
  )
  ipcMain.handle(IPC.WIDGET_INSTANCES_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().deleteInstance(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCE_SHOW, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().expand(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCE_HIDE, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().hide(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCE_TOGGLE, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().toggle(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCE_EXPAND, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().expand(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_INSTANCE_COLLAPSE, (_e, id: string) =>
    wrapIpc(() => {
      widgetManager().collapse(id)
    })
  )
  ipcMain.handle(
    IPC.WIDGET_INSTANCE_SET_DISPLAY_MODE,
    (_e, id: string, mode: import('@shared/widget-display').WidgetDisplayMode) =>
      wrapIpc(() => widgetManager().setDisplayMode(id, mode))
  )

  const captureManager = () => getQuickCaptureWindowManager()

  ipcMain.handle(IPC.CAPTURE_TOGGLE, () =>
    wrapIpc(() => {
      captureManager().toggle()
    })
  )
  ipcMain.handle(IPC.CAPTURE_SHOW, () =>
    wrapIpc(() => {
      captureManager().show()
    })
  )
  ipcMain.handle(IPC.CAPTURE_HIDE, () =>
    wrapIpc(() => {
      captureManager().hide()
    })
  )

  ipcMain.handle(IPC.WIDGET_GET_SETTINGS, () => wrapIpc(() => widgetManager().getSettings()))
  ipcMain.handle(IPC.WIDGET_UPDATE_SETTINGS, (_e, dto: UpdateWidgetSettingsDto) =>
    wrapIpc(() => widgetManager().updateSettings(dto))
  )

  ipcMain.handle(IPC.WIDGET_NOTES_LIST, () => wrapIpc(() => services().widgetNotes.list()))
  ipcMain.handle(IPC.WIDGET_NOTES_CREATE, (_e, dto?: import('@shared/widget-notes').CreateWidgetNoteDto) =>
    wrapIpc(() => services().widgetNotes.create(dto))
  )
  ipcMain.handle(IPC.WIDGET_NOTES_UPDATE, (_e, id: string, dto: import('@shared/widget-notes').UpdateWidgetNoteDto) =>
    wrapIpc(() => services().widgetNotes.update(id, dto))
  )
  ipcMain.handle(IPC.WIDGET_NOTES_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().widgetNotes.delete(id)
    })
  )
  ipcMain.handle(IPC.WIDGET_NOTES_CONVERT_TO_TASK, (_e, id: string, dto?: import('@shared/widget-notes').ConvertWidgetNoteToTaskDto) =>
    wrapIpc(() => services().widgetNotes.convertToTask(id, dto ?? {}))
  )

  ipcMain.handle(IPC.APP_OPEN_MAIN, (_e, route?: string) =>
    wrapIpc(() => {
      const win = getMainWindow()
      if (!win) return
      win.show()
      win.focus()
      if (typeof route === 'string' && route.trim()) {
        win.webContents.send(IPC.APP_NAVIGATE, route.trim())
      }
    })
  )
}

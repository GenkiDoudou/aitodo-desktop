import { app, ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  CreateCategoryDto,
  CreateKanbanGroupDto,
  CreateTaskDto,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateKanbanGroupDto,
  UpdateTaskDto,
  AppMessage,
  AppMessageKind
} from '@shared/types'
import { getActiveDataDir, getDatabase } from '../db/database'
import { CategoryRepository } from '../db/category-repository'
import { KanbanGroupRepository } from '../db/kanban-group-repository'
import { AppMessageRepository } from '../db/app-message-repository'
import { TaskReminderRepository } from '../db/task-reminder-repository'
import { TaskRepository } from '../db/task-repository'
import { CategoryService } from '../services/category-service'
import { AppMessageService } from '../services/app-message-service'
import { KanbanGroupService } from '../services/kanban-group-service'
import { TaskService } from '../services/task-service'
import {
  getDefaultDataDir,
  isDirectoryWritable,
  readShortcutBindings,
  resolveDataDir,
  readLlmConfig,
  readAiPromptConfig,
  saveLlmConfig,
  saveAiPromptConfig,
  savePendingDataDir,
  saveShortcutBindings
} from '../data-path'
import { registerGlobalShortcuts } from '../shortcuts'
import type { ShortcutBindings } from '@shared/shortcuts'
import { findShortcutConflicts } from '@shared/shortcuts'
import type { LlmConfig } from '@shared/llm-config'
import type { AiPromptConfig } from '@shared/ai-prompt-config'
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

function services() {
  const db = getDatabase()
  const taskRepo = new TaskRepository(db)
  const categoryRepo = new CategoryRepository(db)
  const kanbanRepo = new KanbanGroupRepository(db)
  const messageRepo = new AppMessageRepository(db)
  const reminderRepo = new TaskReminderRepository(db)
  return {
    tasks: new TaskService(taskRepo, reminderRepo),
    categories: new CategoryService(categoryRepo),
    kanbanGroups: new KanbanGroupService(kanbanRepo),
    messages: new AppMessageService(messageRepo)
  }
}

let getMainWindowRef: () => BrowserWindow | null = () => null

/** 主进程写入消息后推送给渲染进程（侧栏角标与列表刷新） */
export function pushAppMessageToRenderer(message: AppMessage): void {
  getMainWindowRef()?.webContents.send(IPC.APP_MESSAGE_PUSH, message)
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

  ipcMain.handle(IPC.MESSAGES_LIST, (_e, kind?: AppMessageKind) =>
    wrapIpc(() => services().messages.list(kind))
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
        writable: isDirectoryWritable(dataPath)
      }
    })
  )

  ipcMain.handle(IPC.APP_GET_SHORTCUTS, () => wrapIpc(() => readShortcutBindings()))

  ipcMain.handle(IPC.APP_SET_SHORTCUTS, (_e, bindings: ShortcutBindings) =>
    wrapIpc(() => {
      const conflicts = findShortcutConflicts(bindings)
      if (conflicts.size > 0) {
        const first = [...conflicts.entries()][0]
        throw new AppError(
          'SHORTCUT_CONFLICT',
          `快捷键 ${first[0]} 被多个动作占用：${first[1].join('、')}`
        )
      }
      saveShortcutBindings(bindings)
      const win = getMainWindow()
      if (win) {
        registerGlobalShortcuts(win, bindings)
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

  ipcMain.handle(IPC.APP_SHOW_WINDOW, () =>
    wrapIpc(() => {
      const win = getMainWindow()
      win?.show()
      win?.focus()
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
}

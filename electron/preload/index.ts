import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DesktopApi } from '@shared/desktop-api'
import type {
  CreateCategoryDto,
  CreateKanbanGroupDto,
  CreateTaskDto,
  DeleteTaskOptions,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateKanbanGroupDto,
  UpdateTaskDto
} from '@shared/types'

/**
 * 白名单 IPC 封装：渲染进程仅可调用此处暴露的方法。
 */
const api: DesktopApi = {
  tasks: {
    list: (filter?: TaskListFilter) => ipcRenderer.invoke(IPC.TASKS_LIST, filter),
    get: (id: string) => ipcRenderer.invoke(IPC.TASKS_GET, id),
    getInTrash: (id: string) => ipcRenderer.invoke(IPC.TASKS_GET_IN_TRASH, id),
    create: (dto: CreateTaskDto) => ipcRenderer.invoke(IPC.TASKS_CREATE, dto),
    update: (id: string, dto: UpdateTaskDto) => ipcRenderer.invoke(IPC.TASKS_UPDATE, id, dto),
    delete: (id: string, options?: DeleteTaskOptions) => ipcRenderer.invoke(IPC.TASKS_DELETE, id, options),
    restore: (id: string) => ipcRenderer.invoke(IPC.TASKS_RESTORE, id),
    permanentDelete: (id: string, options?: DeleteTaskOptions) =>
      ipcRenderer.invoke(IPC.TASKS_PERMANENT_DELETE, id, options),
    emptyTrash: () => ipcRenderer.invoke(IPC.TASKS_EMPTY_TRASH),
    countTrash: () => ipcRenderer.invoke(IPC.TASKS_COUNT_TRASH),
    countDone: () => ipcRenderer.invoke(IPC.TASKS_COUNT_DONE)
  },
  kanbanGroups: {
    list: (scopeKey: string) => ipcRenderer.invoke(IPC.KANBAN_GROUPS_LIST, scopeKey),
    create: (dto: CreateKanbanGroupDto) => ipcRenderer.invoke(IPC.KANBAN_GROUPS_CREATE, dto),
    update: (id: string, dto: UpdateKanbanGroupDto) =>
      ipcRenderer.invoke(IPC.KANBAN_GROUPS_UPDATE, id, dto),
    delete: (id: string) => ipcRenderer.invoke(IPC.KANBAN_GROUPS_DELETE, id)
  },
  messages: {
    list: (kind?: import('@shared/types').AppMessageKind) =>
      ipcRenderer.invoke(IPC.MESSAGES_LIST, kind),
    countUnread: (kind?: import('@shared/types').AppMessageKind) =>
      ipcRenderer.invoke(IPC.MESSAGES_COUNT_UNREAD, kind),
    markRead: (id: string) => ipcRenderer.invoke(IPC.MESSAGES_MARK_READ, id),
    markAllRead: (kind?: import('@shared/types').AppMessageKind) =>
      ipcRenderer.invoke(IPC.MESSAGES_MARK_ALL_READ, kind)
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST),
    create: (dto: CreateCategoryDto) => ipcRenderer.invoke(IPC.CATEGORIES_CREATE, dto),
    update: (id: string, dto: UpdateCategoryDto) =>
      ipcRenderer.invoke(IPC.CATEGORIES_UPDATE, id, dto),
    delete: (id: string) => ipcRenderer.invoke(IPC.CATEGORIES_DELETE, id)
  },
  app: {
    getDataPath: () => ipcRenderer.invoke(IPC.APP_GET_DATA_PATH),
    setDataPath: (path: string) => ipcRenderer.invoke(IPC.APP_SET_DATA_PATH, path),
    getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),
    getInfo: () => ipcRenderer.invoke(IPC.APP_GET_INFO),
    getShortcuts: () => ipcRenderer.invoke(IPC.APP_GET_SHORTCUTS),
    setShortcuts: (bindings) => ipcRenderer.invoke(IPC.APP_SET_SHORTCUTS, bindings),
    getLlmConfig: () => ipcRenderer.invoke(IPC.APP_GET_LLM_CONFIG),
    setLlmConfig: (config) => ipcRenderer.invoke(IPC.APP_SET_LLM_CONFIG, config),
    getAiPrompt: () => ipcRenderer.invoke(IPC.APP_GET_AI_PROMPT),
    setAiPrompt: (config) => ipcRenderer.invoke(IPC.APP_SET_AI_PROMPT, config),
    showWindow: () => ipcRenderer.invoke(IPC.APP_SHOW_WINDOW),
    pickAttachment: () => ipcRenderer.invoke(IPC.APP_PICK_ATTACHMENT),
    saveAttachment: (dto) => ipcRenderer.invoke(IPC.APP_SAVE_ATTACHMENT, dto),
    resolveAttachmentUrl: (uri) => ipcRenderer.invoke(IPC.APP_RESOLVE_ATTACHMENT_URL, uri),
    openAttachment: (uri) => ipcRenderer.invoke(IPC.APP_OPEN_ATTACHMENT, uri),
    downloadAttachment: (uri, suggestedName) =>
      ipcRenderer.invoke(IPC.APP_DOWNLOAD_ATTACHMENT, uri, suggestedName),
    onNewTask: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC.APP_NEW_TASK, listener)
      return () => ipcRenderer.removeListener(IPC.APP_NEW_TASK, listener)
    },
    onAction: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, action: string) => {
        callback(action as import('@shared/shortcuts').ShortcutActionId)
      }
      ipcRenderer.on(IPC.APP_ACTION, listener)
      return () => ipcRenderer.removeListener(IPC.APP_ACTION, listener)
    },
    onMessagePush: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, message: import('@shared/types').AppMessage) => {
        callback(message)
      }
      ipcRenderer.on(IPC.APP_MESSAGE_PUSH, listener)
      return () => ipcRenderer.removeListener(IPC.APP_MESSAGE_PUSH, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { WidgetApi } from '@shared/widget-api'
import type { TaskListFilter, UpdateTaskDto } from '@shared/types'
import type {
  ConvertWidgetNoteToTaskDto,
  CreateWidgetNoteDto,
  UpdateWidgetInstanceDto,
  UpdateWidgetNoteDto,
  WidgetInstance
} from '@shared/widget-notes'
import type { WidgetDisplayMode } from '@shared/widget-display'

/** 挂件窗口专用 preload */
const widgetApi: WidgetApi = {
  widget: {
    getInstance: (id: string) => ipcRenderer.invoke(IPC.WIDGET_INSTANCES_GET, id),
    updateInstance: (id: string, dto: UpdateWidgetInstanceDto) =>
      ipcRenderer.invoke(IPC.WIDGET_INSTANCES_UPDATE, id, dto),
    collapse: (id: string) => ipcRenderer.invoke(IPC.WIDGET_INSTANCE_COLLAPSE, id),
    expand: (id: string) => ipcRenderer.invoke(IPC.WIDGET_INSTANCE_EXPAND, id),
    hide: (id: string) => ipcRenderer.invoke(IPC.WIDGET_INSTANCE_HIDE, id),
    setDisplayMode: (id: string, mode: WidgetDisplayMode) =>
      ipcRenderer.invoke(IPC.WIDGET_INSTANCE_SET_DISPLAY_MODE, id, mode),
    onDisplayModeChanged: (callback: (instance: WidgetInstance) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, instance: WidgetInstance) => {
        callback(instance)
      }
      ipcRenderer.on(IPC.WIDGET_DISPLAY_MODE_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC.WIDGET_DISPLAY_MODE_CHANGED, listener)
    }
  },
  widgetNotes: {
    list: () => ipcRenderer.invoke(IPC.WIDGET_NOTES_LIST),
    create: (dto?: CreateWidgetNoteDto) => ipcRenderer.invoke(IPC.WIDGET_NOTES_CREATE, dto),
    update: (id: string, dto: UpdateWidgetNoteDto) => ipcRenderer.invoke(IPC.WIDGET_NOTES_UPDATE, id, dto),
    delete: (id: string) => ipcRenderer.invoke(IPC.WIDGET_NOTES_DELETE, id),
    convertToTask: (id: string, dto: ConvertWidgetNoteToTaskDto) =>
      ipcRenderer.invoke(IPC.WIDGET_NOTES_CONVERT_TO_TASK, id, dto)
  },
  tasks: {
    list: (filter?: TaskListFilter) => ipcRenderer.invoke(IPC.TASKS_LIST, filter),
    update: (id: string, dto: UpdateTaskDto) => ipcRenderer.invoke(IPC.TASKS_UPDATE, id, dto)
  },
  taskViews: {
    list: () => ipcRenderer.invoke(IPC.TASK_VIEWS_LIST)
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST)
  },
  kanbanGroups: {
    list: (scopeKey: string) => ipcRenderer.invoke(IPC.KANBAN_GROUPS_LIST, scopeKey)
  },
  app: {
    openMain: (route?: string) => ipcRenderer.invoke(IPC.APP_OPEN_MAIN, route)
  }
}

contextBridge.exposeInMainWorld('widgetApi', widgetApi)

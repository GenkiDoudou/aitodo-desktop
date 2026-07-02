import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DesktopApi } from '@shared/desktop-api'
import type {
  CreateCategoryDto,
  CreateTaskDto,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateTaskDto
} from '@shared/types'

/**
 * 白名单 IPC 封装：渲染进程仅可调用此处暴露的方法。
 */
const api: DesktopApi = {
  tasks: {
    list: (filter?: TaskListFilter) => ipcRenderer.invoke(IPC.TASKS_LIST, filter),
    get: (id: string) => ipcRenderer.invoke(IPC.TASKS_GET, id),
    create: (dto: CreateTaskDto) => ipcRenderer.invoke(IPC.TASKS_CREATE, dto),
    update: (id: string, dto: UpdateTaskDto) => ipcRenderer.invoke(IPC.TASKS_UPDATE, id, dto),
    delete: (id: string) => ipcRenderer.invoke(IPC.TASKS_DELETE, id)
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
    onNewTask: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC.APP_NEW_TASK, listener)
      return () => ipcRenderer.removeListener(IPC.APP_NEW_TASK, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

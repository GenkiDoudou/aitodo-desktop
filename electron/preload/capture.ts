import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { CaptureApi } from '@shared/capture-api'
import type { CreateTaskDto } from '@shared/types'
import type { AiParseCategoryRef } from '@shared/ai-task-parser'

const captureApi: CaptureApi = {
  tasks: {
    create: (dto: CreateTaskDto) => ipcRenderer.invoke(IPC.TASKS_CREATE, dto)
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST)
  },
  parseTaskInput: (text: string, categories?: AiParseCategoryRef[]) =>
    ipcRenderer.invoke(IPC.APP_PARSE_TASK_INPUT, text, categories),
  capture: {
    hide: () => ipcRenderer.invoke(IPC.CAPTURE_HIDE),
    onFocusRequest: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on(IPC.CAPTURE_FOCUS, handler)
      return () => ipcRenderer.removeListener(IPC.CAPTURE_FOCUS, handler)
    }
  }
}

contextBridge.exposeInMainWorld('captureApi', captureApi)

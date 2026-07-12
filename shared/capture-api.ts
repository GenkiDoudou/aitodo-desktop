import type { Category, CreateTaskDto, IpcResult, Task } from '@shared/types'

/**
 * 快捷任务输入窗口 preload 暴露的 API。
 */
export interface CaptureApi {
  tasks: {
    create(dto: CreateTaskDto): Promise<IpcResult<Task>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
  }
  capture: {
    hide(): Promise<IpcResult<void>>
    onFocusRequest(callback: () => void): () => void
  }
}

declare global {
  interface Window {
    captureApi: CaptureApi
  }
}

export {}

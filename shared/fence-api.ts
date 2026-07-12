import type { IpcResult } from '@shared/types'
import type {
  DesktopFenceLayout,
  DesktopFenceScanPayload,
  DesktopFenceSettings,
  UpdateDesktopFenceLayoutDto,
  UpdateDesktopFenceSettingsDto
} from '@shared/fence-types'

export interface FenceApi {
  getSettings(): Promise<IpcResult<DesktopFenceSettings>>
  updateSettings(dto: UpdateDesktopFenceSettingsDto): Promise<IpcResult<DesktopFenceSettings>>
  showAll(): Promise<IpcResult<void>>
  hideAll(): Promise<IpcResult<void>>
  listLayouts(): Promise<IpcResult<DesktopFenceLayout[]>>
  updateLayout(categoryId: string, dto: UpdateDesktopFenceLayoutDto): Promise<IpcResult<DesktopFenceLayout>>
  onScanPush(callback: (payload: DesktopFenceScanPayload) => void): () => void
  hide(): Promise<IpcResult<void>>
  getSlotId(): string
  getFileIcon(filePath: string): Promise<IpcResult<string>>
  openItem(filePath: string): Promise<IpcResult<void>>
  beginDrag(itemPath: string): Promise<IpcResult<void>>
  dropItem(targetCategoryId: string): Promise<IpcResult<void>>
  endDrag(): Promise<IpcResult<void>>
}

declare global {
  interface Window {
    fenceApi: FenceApi
  }
}

export {}

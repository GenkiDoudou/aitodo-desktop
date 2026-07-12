import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { FenceApi } from '@shared/fence-api'
import type { UpdateDesktopFenceLayoutDto, UpdateDesktopFenceSettingsDto } from '@shared/fence-types'
import type { FenceSlotId } from '@shared/fence-slot-config'

function readSlotId(): FenceSlotId {
  const fromUrl = new URL(window.location.href).searchParams.get('slotId')
  if (fromUrl === 'slot-apps' || fromUrl === 'slot-folders' || fromUrl === 'slot-files') {
    return fromUrl
  }
  const arg = process.argv.find((a) => a.startsWith('--slot-id='))
  const value = arg?.slice('--slot-id='.length)
  if (value === 'slot-apps' || value === 'slot-folders' || value === 'slot-files') {
    return value
  }
  return 'slot-apps'
}

const slotId = readSlotId()

const fenceApi: FenceApi = {
  getSettings: () => ipcRenderer.invoke(IPC.FENCE_GET_SETTINGS),
  updateSettings: (dto: UpdateDesktopFenceSettingsDto) => ipcRenderer.invoke(IPC.FENCE_UPDATE_SETTINGS, dto),
  showAll: () => ipcRenderer.invoke(IPC.FENCE_SHOW_ALL),
  hideAll: () => ipcRenderer.invoke(IPC.FENCE_HIDE_ALL),
  listLayouts: () => ipcRenderer.invoke(IPC.FENCE_LIST_LAYOUTS),
  updateLayout: (id: string, dto: UpdateDesktopFenceLayoutDto) =>
    ipcRenderer.invoke(IPC.FENCE_UPDATE_LAYOUT, id, dto),
  onScanPush: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: import('@shared/fence-types').DesktopFenceScanPayload) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.FENCE_SCAN_PUSH, listener)
    return () => ipcRenderer.removeListener(IPC.FENCE_SCAN_PUSH, listener)
  },
  hide: () => ipcRenderer.invoke(IPC.FENCE_HIDE_WINDOW, slotId),
  getSlotId: () => slotId,
  getFileIcon: (filePath: string) => ipcRenderer.invoke(IPC.FENCE_GET_FILE_ICON, filePath),
  openItem: (filePath: string) => ipcRenderer.invoke(IPC.FENCE_OPEN_ITEM, filePath),
  beginDrag: (itemPath: string) => ipcRenderer.invoke(IPC.FENCE_BEGIN_DRAG, itemPath),
  dropItem: (targetCategoryId: string) => ipcRenderer.invoke(IPC.FENCE_DROP_ITEM, targetCategoryId),
  endDrag: () => ipcRenderer.invoke(IPC.FENCE_END_DRAG)
}

contextBridge.exposeInMainWorld('fenceApi', fenceApi)

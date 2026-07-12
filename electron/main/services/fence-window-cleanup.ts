import { BrowserWindow } from 'electron'
import { detachFenceWindowFromDesktop } from './desktop-fence-pin'

/** 是否为 Fence 渲染窗（含旧版 categoryId 与新版 slotId） */
export function isFenceBrowserWindow(win: BrowserWindow): boolean {
  if (win.isDestroyed()) return false
  const title = win.getTitle()
  if (title.startsWith('Fence') || title.includes('小柒todo Fence')) return true
  try {
    const url = win.webContents.getURL()
    if (url.includes('fence.html')) return true
    if (url.includes('categoryId=')) return true
    if (url.includes('slotId=')) return true
  } catch {
    /* webContents 未就绪 */
  }
  return false
}

/** 销毁所有 Fence 窗（含未纳入 FenceWindowManager 管理的遗留窗） */
export function destroyAllFenceBrowserWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (isFenceBrowserWindow(win) && !win.isDestroyed()) {
      detachFenceWindowFromDesktop(win)
      win.destroy()
    }
  }
}

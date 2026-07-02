import { BrowserWindow, Menu, Tray, nativeImage, app } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc-channels'
import type { ShortcutActionId } from '@shared/shortcuts'

let tray: Tray | null = null

export type TrayActions = {
  onShow: () => void
  onNewTask: () => void
  onQuit: () => void
}

/** 创建系统托盘；关闭窗口时最小化到托盘而非退出 */
export function createTray(mainWindow: BrowserWindow, actions: TrayActions): Tray {
  const iconPath = join(__dirname, '../../resources/tray.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    image = nativeImage.createEmpty()
  }

  tray = new Tray(image)
  tray.setToolTip('aiTodo')

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: actions.onShow },
    {
      label: '新建任务',
      click: () => {
        actions.onShow()
        mainWindow.webContents.send(IPC.APP_ACTION, 'newTask' satisfies ShortcutActionId)
        actions.onNewTask()
      }
    },
    { type: 'separator' },
    { label: '退出', click: actions.onQuit }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', actions.onShow)
  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/** 阻止关闭并隐藏窗口（托盘模式） */
export function bindMinimizeToTray(mainWindow: BrowserWindow): void {
  mainWindow.on('close', (event) => {
    if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

export function markQuitting(): void {
  ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true
}

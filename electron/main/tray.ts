import { BrowserWindow, Menu, Tray, nativeImage, app } from 'electron'

import { existsSync } from 'fs'

import { join } from 'path'

import { IPC } from '@shared/ipc-channels'

import type { ShortcutActionId } from '@shared/shortcuts'

import type { CloseBehavior } from '@shared/close-behavior'

import { readCloseBehavior } from './data-path'



let tray: Tray | null = null



export type TrayActions = {

  onShow: () => void

  onToggleWidget: () => void

  onNewTask: () => void

  onQuit: () => void

}



function resolveTrayIconPath(): string | null {

  const candidates = [

    join(process.resourcesPath, 'tray.png'),

    join(__dirname, '../../resources/tray.png'),

    join(app.getAppPath(), 'resources/tray.png')

  ]

  return candidates.find((path) => existsSync(path)) ?? null

}



async function loadTrayImage(): Promise<Electron.NativeImage> {

  const iconPath = resolveTrayIconPath()

  if (iconPath) {

    const image = nativeImage.createFromPath(iconPath)

    if (!image.isEmpty()) {

      return image.resize({ width: 16, height: 16 })

    }

  }



  try {

    const exeIcon = await app.getFileIcon(process.execPath, { size: 'small' })

    if (!exeIcon.isEmpty()) {

      return exeIcon.resize({ width: 16, height: 16 })

    }

  } catch {

    /* 回退失败时继续 */

  }



  return nativeImage.createEmpty()

}



/** 创建系统托盘；关闭窗口时最小化到托盘而非退出 */

export async function createTray(mainWindow: BrowserWindow, actions: TrayActions): Promise<Tray> {

  const image = await loadTrayImage()

  if (image.isEmpty()) {

    console.warn('[aiTodo] 托盘图标加载失败，托盘可能不可见')

  }



  tray = new Tray(image)

  tray.setToolTip('小柒todo')



  const contextMenu = Menu.buildFromTemplate([

    { label: '显示主窗口', click: actions.onShow },

    { label: '打开挂件', click: actions.onToggleWidget },

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



type CloseBehaviorDeps = {

  readCloseBehavior?: () => CloseBehavior

}



/** 按用户偏好处理主窗口关闭：询问、隐藏到托盘或退出应用 */

export function bindMinimizeToTray(mainWindow: BrowserWindow, deps: CloseBehaviorDeps = {}): void {

  const getCloseBehavior = deps.readCloseBehavior ?? readCloseBehavior



  mainWindow.on('close', (event) => {

    if ((app as typeof app & { isQuitting?: boolean }).isQuitting) {

      return

    }



    const behavior = getCloseBehavior()

    if (behavior === 'quit') {

      markQuitting()

      return

    }



    if (behavior === 'ask') {

      event.preventDefault()

      mainWindow.webContents.send(IPC.APP_CLOSE_REQUEST)

      return

    }



    event.preventDefault()

    mainWindow.hide()

  })

}



export function markQuitting(): void {

  ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true

}



/** 显示主窗口；若已可见则隐藏到托盘（快捷键切换） */

export function toggleMainWindow(mainWindow: BrowserWindow | null | undefined): void {

  if (!mainWindow || mainWindow.isDestroyed()) return

  if (mainWindow.isVisible()) {

    mainWindow.hide()

    return

  }

  mainWindow.show()

  mainWindow.focus()

}


import { app, BrowserWindow, dialog, Menu } from 'electron'
import { join } from 'path'
import { getDatabase, closeDatabase, DatabaseNotWritableError } from './db/database'
import { registerIpcHandlers, pushAppMessageToRenderer } from './ipc/handlers'
import { TaskRepository } from './db/task-repository'
import { AppMessageRepository } from './db/app-message-repository'
import { TaskReminderRepository } from './db/task-reminder-repository'
import { AppMessageService } from './services/app-message-service'
import { ReminderService } from './services/reminder-service'
import { HolidayService } from './services/holiday-service'
import { bindMinimizeToTray, createTray, destroyTray, markQuitting } from './tray'
import { resolveDataDir } from './data-path'
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts'
import {
  registerAttachmentProtocol,
  registerAttachmentSchemePrivilege
} from './attachment-protocol'

registerAttachmentSchemePrivilege()

let mainWindow: BrowserWindow | null = null
let reminderService: ReminderService | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 560,
    title: 'aiTodo',
    /** 不显示系统菜单栏（File / Edit / View …） */
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  bindMinimizeToTray(win)
  return win
}

function bootstrapDatabase(): boolean {
  try {
    getDatabase()
    return true
  } catch (err) {
    if (err instanceof DatabaseNotWritableError) {
      dialog.showErrorBox(
        '数据目录不可写',
        `${err.message}\n\n请安装到可写目录，或在设置中更改数据存储位置后重启应用。`
      )
    } else {
      dialog.showErrorBox('数据库初始化失败', err instanceof Error ? err.message : String(err))
    }
    return false
  }
}

app.whenReady().then(() => {
  if (!bootstrapDatabase()) {
    app.quit()
    return
  }

  /** 移除默认应用菜单（Windows/Linux 顶栏 File/Edit/View/Window/Help） */
  Menu.setApplicationMenu(null)

  registerAttachmentProtocol()
  registerIpcHandlers(() => mainWindow)
  mainWindow = createWindow()
  registerGlobalShortcuts(mainWindow)

  const db = getDatabase()
  const taskRepo = new TaskRepository(db)
  const messageService = new AppMessageService(new AppMessageRepository(db))
  const reminderRepo = new TaskReminderRepository(db)
  const holidayService = new HolidayService()
  reminderService = new ReminderService(
    taskRepo,
    reminderRepo,
    messageService,
    holidayService,
    pushAppMessageToRenderer
  )
  reminderService.start()

  createTray(mainWindow, {
    onShow: () => {
      mainWindow?.show()
      mainWindow?.focus()
    },
    onNewTask: () => {},
    onQuit: () => {
      markQuitting()
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  markQuitting()
  unregisterGlobalShortcuts()
  reminderService?.stop()
  destroyTray()
  closeDatabase()
})

app.on('window-all-closed', () => {
  // 托盘模式：Windows 上关闭窗口不退出进程
})

if (!app.isPackaged) {
  console.log('[aiTodo] data dir:', resolveDataDir())
}

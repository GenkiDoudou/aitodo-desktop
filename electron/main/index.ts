import { app, BrowserWindow, dialog, Menu } from 'electron'
import { join } from 'path'
import { getDatabase, closeDatabase, DatabaseNotWritableError } from './db/database'
import {
  registerIpcHandlers,
  pushAppMessageToRenderer,
  setSummarySchedulerService,
  setHolidayService
} from './ipc/handlers'
import { TaskRepository } from './db/task-repository'
import { AppMessageRepository } from './db/app-message-repository'
import { TaskReminderRepository } from './db/task-reminder-repository'
import { AppMessageService } from './services/app-message-service'
import { ReminderService } from './services/reminder-service'
import { SummarySchedulerService } from './services/summary-scheduler-service'
import { ScheduledSummaryRepository } from './db/scheduled-summary-repository'
import { ScheduledSummaryService } from './services/scheduled-summary-service'
import { CategoryRepository } from './db/category-repository'
import { TaskActivityRepository } from './db/task-activity-repository'
import { HolidayService } from './services/holiday-service'
import { TaskActivityService } from './services/task-activity-service'
import { bindMinimizeToTray, createTray, destroyTray, markQuitting } from './tray'
import { resolveDataDir } from './data-path'
import { registerGlobalShortcuts, unregisterGlobalShortcuts, createDefaultShortcutHandlers } from './shortcuts'
import { getWidgetWindowManager } from './widget-window-manager'
import { getQuickCaptureWindowManager } from './quick-capture-window-manager'
import {
  registerAttachmentProtocol,
  registerAttachmentSchemePrivilege
} from './attachment-protocol'
import { registerNotificationSupport } from './services/system-notification'

let mainWindow: BrowserWindow | null = null
let reminderService: ReminderService | null = null
let summarySchedulerService: SummarySchedulerService | null = null

registerNotificationSupport()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 560,
    title: '小柒todo',
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
  try {
    const db = getDatabase()
    new TaskActivityService(new TaskActivityRepository(db)).purgeByCurrentPolicy()
  } catch {
    /* 启动清理失败不阻塞应用 */
  }
  mainWindow = createWindow()
  registerGlobalShortcuts(mainWindow, createDefaultShortcutHandlers(() => mainWindow))

  const db = getDatabase()
  const taskRepo = new TaskRepository(db)
  const messageService = new AppMessageService(new AppMessageRepository(db))
  const reminderRepo = new TaskReminderRepository(db)
  const holidayService = new HolidayService()
  setHolidayService(holidayService)
  reminderService = new ReminderService(
    taskRepo,
    reminderRepo,
    messageService,
    holidayService,
    pushAppMessageToRenderer
  )
  reminderService.start()

  const summaryRepo = new ScheduledSummaryRepository(db)
  const categoryRepo = new CategoryRepository(db)
  summarySchedulerService = new SummarySchedulerService(
    summaryRepo,
    new ScheduledSummaryService(summaryRepo, taskRepo, categoryRepo),
    messageService,
    pushAppMessageToRenderer
  )
  setSummarySchedulerService(summarySchedulerService)
  summarySchedulerService.start()

  createTray(mainWindow, {
    onShow: () => {
      mainWindow?.show()
      mainWindow?.focus()
    },
    onToggleWidget: () => {
      getWidgetWindowManager().toggle()
    },
    onNewTask: () => {
      getQuickCaptureWindowManager().toggle()
    },
    onQuit: () => {
      markQuitting()
      app.quit()
    }
  }).catch((err) => {
    console.error('[aiTodo] 创建托盘失败', err)
  })

  try {
    getWidgetWindowManager().restoreOnStartup()
  } catch {
    /* 挂件设置读取失败不阻塞启动 */
  }

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
  getWidgetWindowManager().destroy()
  getQuickCaptureWindowManager().destroy()
  reminderService?.stop()
  summarySchedulerService?.stop()
  destroyTray()
  closeDatabase()
})

app.on('window-all-closed', () => {
  // 托盘模式默认保留进程；显式退出时才真正结束应用。
  if ((app as typeof app & { isQuitting?: boolean }).isQuitting) {
    app.quit()
  }
})

if (!app.isPackaged) {
  console.log('[aiTodo] data dir:', resolveDataDir())
}

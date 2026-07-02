import { app, ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  CreateCategoryDto,
  CreateTaskDto,
  TaskListFilter,
  UpdateCategoryDto,
  UpdateTaskDto
} from '@shared/types'
import { getActiveDataDir, getDatabase } from '../db/database'
import { CategoryRepository } from '../db/category-repository'
import { TaskRepository } from '../db/task-repository'
import { CategoryService } from '../services/category-service'
import { TaskService } from '../services/task-service'
import {
  getDefaultDataDir,
  isDirectoryWritable,
  readShortcutBindings,
  resolveDataDir,
  savePendingDataDir,
  saveShortcutBindings
} from '../data-path'
import { registerGlobalShortcuts } from '../shortcuts'
import type { ShortcutBindings } from '@shared/shortcuts'
import { findShortcutConflicts } from '@shared/shortcuts'
import { AppError } from '@shared/types'
import { wrapIpc } from './wrap'

function services() {
  const db = getDatabase()
  const taskRepo = new TaskRepository(db)
  const categoryRepo = new CategoryRepository(db)
  return {
    tasks: new TaskService(taskRepo),
    categories: new CategoryService(categoryRepo)
  }
}

/** 注册全部 IPC handler；在 app.whenReady 且数据库可用后调用 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.TASKS_LIST, (_e, filter?: TaskListFilter) =>
    wrapIpc(() => services().tasks.list(filter))
  )
  ipcMain.handle(IPC.TASKS_GET, (_e, id: string) => wrapIpc(() => services().tasks.get(id)))
  ipcMain.handle(IPC.TASKS_CREATE, (_e, dto: CreateTaskDto) =>
    wrapIpc(() => services().tasks.create(dto))
  )
  ipcMain.handle(IPC.TASKS_UPDATE, (_e, id: string, dto: UpdateTaskDto) =>
    wrapIpc(() => services().tasks.update(id, dto))
  )
  ipcMain.handle(IPC.TASKS_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().tasks.delete(id)
      return undefined
    })
  )

  ipcMain.handle(IPC.CATEGORIES_LIST, () => wrapIpc(() => services().categories.list()))
  ipcMain.handle(IPC.CATEGORIES_CREATE, (_e, dto: CreateCategoryDto) =>
    wrapIpc(() => services().categories.create(dto))
  )
  ipcMain.handle(IPC.CATEGORIES_UPDATE, (_e, id: string, dto: UpdateCategoryDto) =>
    wrapIpc(() => services().categories.update(id, dto))
  )
  ipcMain.handle(IPC.CATEGORIES_DELETE, (_e, id: string) =>
    wrapIpc(() => {
      services().categories.delete(id)
      return undefined
    })
  )

  ipcMain.handle(IPC.APP_GET_DATA_PATH, () => wrapIpc(() => getActiveDataDir()))
  ipcMain.handle(IPC.APP_SET_DATA_PATH, (_e, newPath: string) =>
    wrapIpc(() => {
      savePendingDataDir(getDefaultDataDir(), newPath)
      return { requiresRestart: true as const, pendingPath: newPath }
    })
  )
  ipcMain.handle(IPC.APP_GET_VERSION, () => wrapIpc(() => app.getVersion()))
  ipcMain.handle(IPC.APP_GET_INFO, () =>
    wrapIpc(() => {
      const dataPath = getActiveDataDir()
      return {
        version: app.getVersion(),
        dataPath,
        writable: isDirectoryWritable(dataPath)
      }
    })
  )

  ipcMain.handle(IPC.APP_GET_SHORTCUTS, () => wrapIpc(() => readShortcutBindings()))

  ipcMain.handle(IPC.APP_SET_SHORTCUTS, (_e, bindings: ShortcutBindings) =>
    wrapIpc(() => {
      const conflicts = findShortcutConflicts(bindings)
      if (conflicts.size > 0) {
        const first = [...conflicts.entries()][0]
        throw new AppError(
          'SHORTCUT_CONFLICT',
          `快捷键 ${first[0]} 被多个动作占用：${first[1].join('、')}`
        )
      }
      saveShortcutBindings(bindings)
      const win = getMainWindow()
      if (win) {
        registerGlobalShortcuts(win, bindings)
      }
      return bindings
    })
  )

  ipcMain.handle(IPC.APP_SHOW_WINDOW, () =>
    wrapIpc(() => {
      const win = getMainWindow()
      win?.show()
      win?.focus()
    })
  )
}

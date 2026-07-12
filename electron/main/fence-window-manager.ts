import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc-channels'
import type { DesktopCategory, DesktopOrganizePlan } from '@shared/desktop-organize-types'
import type { DesktopFenceScanPayload } from '@shared/fence-types'
import { FENCE_SLOT_IDS, FENCE_SLOTS, type FenceSlotId } from '@shared/fence-slot-config'
import { FenceLayoutRepository } from './db/fence-layout-repository'
import { getDatabase } from './db/database'
import {
  detachFenceWindowFromDesktop,
  destroyOrphanFenceHwnds,
  lowerFenceWindowToDesktop,
  purgeDesktopFenceArtifacts
} from './services/desktop-fence-pin'
import { destroyAllFenceBrowserWindows } from './services/fence-window-cleanup'

export type ShowAllOptions = {
  /** 强制重新显示曾被用户关闭的容器，并重置为参考图布局 */
  forceShow?: boolean
  /** 显示前是否重启 Explorer 清黑框（默认仅首次/收起时） */
  purgeArtifacts?: boolean
}

/** 固定 3 槽位 Fence（左应用 / 右上文件夹 / 右下文件 Tab） */
export class FenceWindowManager {
  private readonly windows = new Map<FenceSlotId, BrowserWindow>()
  private saveBoundsTimers = new Map<FenceSlotId, ReturnType<typeof setTimeout>>()
  private lastPayload: DesktopFenceScanPayload | null = null
  private artifactsPurgedThisSession = false

  private get repo(): FenceLayoutRepository {
    return new FenceLayoutRepository(getDatabase())
  }

  getSettings() {
    return this.repo.getSettings()
  }

  updateSettings(dto: Parameters<FenceLayoutRepository['updateSettings']>[0]) {
    const settings = this.repo.updateSettings(dto)
    if (dto.fencesEnabled === false) {
      // 只销毁窗口，不立刻重启 Explorer；由 IPC 先恢复 HideIcons 再统一 purge
      this.destroyAll({ purgeArtifacts: false })
    }
    return settings
  }

  showAll(_categories: DesktopCategory[], _alwaysOnTop: boolean, options?: ShowAllOptions): void {
    const shouldPurge = options?.purgeArtifacts === true || !this.artifactsPurgedThisSession
    this.destroyAll({ purgeArtifacts: shouldPurge })
    if (shouldPurge) {
      this.artifactsPurgedThisSession = true
    }

    if (options?.forceShow) {
      this.repo.setAllVisible(true)
    }

    const workArea = screen.getPrimaryDisplay().workArea
    this.repo.ensureSlotLayouts(workArea)

    if (options?.forceShow) {
      this.repo.resetSlotLayouts(workArea)
    } else {
      this.repo.syncSlotDimensions(workArea)
    }

    const layouts = this.repo.listLayouts()
    const slotLayouts = FENCE_SLOT_IDS.map((slotId) => layouts.find((l) => l.categoryId === slotId)).filter(
      (l): l is NonNullable<typeof l> => l != null
    )

    // 若刚重启了 Explorer，稍等再创建窗，避免壳未就绪
    const create = () => {
      for (const layout of slotLayouts) {
        if (!layout.visible && !options?.forceShow) continue
        this.showSlotWindow(layout.categoryId as FenceSlotId, layout)
      }
    }

    if (shouldPurge) {
      setTimeout(create, 1800)
    } else {
      create()
    }
  }

  hideAll(): void {
    this.destroyAll({ purgeArtifacts: true })
  }

  hideSlot(slotId: FenceSlotId): void {
    const win = this.windows.get(slotId)
    if (win && !win.isDestroyed()) {
      this.destroyFenceWindow(win)
      this.windows.delete(slotId)
      this.repo.updateLayout(slotId, { visible: false })
    }
  }

  destroyAll(options?: { purgeArtifacts?: boolean }): void {
    for (const win of this.windows.values()) {
      this.destroyFenceWindow(win)
    }
    this.windows.clear()
    this.saveBoundsTimers.clear()
    destroyAllFenceBrowserWindows()
    destroyOrphanFenceHwnds()
    if (options?.purgeArtifacts) {
      // 黑框是桌面层 DWM 脏区，必须重启 Explorer 才能清掉
      purgeDesktopFenceArtifacts()
    }
  }

  broadcastPlan(plan: DesktopOrganizePlan, categories: DesktopCategory[], folderPrefix: string): void {
    this.lastPayload = {
      scannedAt: plan.scannedAt,
      desktopPath: plan.desktopPath,
      folderPrefix,
      categories: categories.filter((c) => c.enabled),
      items: plan.items,
      moves: plan.moves
    }
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.FENCE_SCAN_PUSH, this.lastPayload)
      }
    }
  }

  private destroyFenceWindow(win: BrowserWindow): void {
    if (win.isDestroyed()) return
    detachFenceWindowFromDesktop(win)
    win.destroy()
  }

  private showSlotWindow(
    slotId: FenceSlotId,
    layout: { x: number; y: number; width: number; height: number }
  ): void {
    let win = this.windows.get(slotId)

    if (win && !win.isDestroyed()) {
      win.setBounds(layout)
      lowerFenceWindowToDesktop(win)
      win.show()
      if (this.lastPayload) {
        win.webContents.send(IPC.FENCE_SCAN_PUSH, this.lastPayload)
      }
      return
    }

    const slot = FENCE_SLOTS[slotId]
    const panelBg = '#2a585c'

    win = new BrowserWindow({
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      minWidth: 320,
      minHeight: 160,
      frame: false,
      transparent: false,
      backgroundColor: panelBg,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      show: false,
      focusable: true,
      title: `Fence-${slot.title}`,
      autoHideMenuBar: true,
      type: 'toolbar',
      webPreferences: {
        preload: join(__dirname, '../preload/fence.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        additionalArguments: [`--slot-id=${slotId}`]
      }
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/fence.html?slotId=${encodeURIComponent(slotId)}`)
    } else {
      void win.loadFile(join(__dirname, '../renderer/fence.html'), {
        query: { slotId }
      })
    }

    let shown = false
    const showWindow = () => {
      if (shown || win.isDestroyed()) return
      shown = true
      lowerFenceWindowToDesktop(win)
      win.showInactive()
      // 再置底一次，避免 show 后被抬到上层
      setTimeout(() => {
        if (!win.isDestroyed()) lowerFenceWindowToDesktop(win)
      }, 200)
      if (this.lastPayload) {
        win.webContents.send(IPC.FENCE_SCAN_PUSH, this.lastPayload)
      }
    }

    win.once('ready-to-show', showWindow)
    setTimeout(showWindow, 1500)

    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error(`[fence] load failed ${slotId}:`, code, desc)
    })

    win.on('close', (event) => {
      if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
        event.preventDefault()
        this.destroyFenceWindow(win)
        this.windows.delete(slotId)
        this.repo.updateLayout(slotId, { visible: false })
      }
    })

    // 拖动后重新置底，避免像普通悬浮窗一样盖住其它应用
    win.on('moved', () => {
      lowerFenceWindowToDesktop(win!)
      this.scheduleSaveBounds(slotId, win!)
    })
    win.on('resized', () => this.scheduleSaveBounds(slotId, win!))
    win.on('focus', () => {
      // 聚焦后短暂允许操作，失焦再置底
    })
    win.on('blur', () => {
      if (!win.isDestroyed()) lowerFenceWindowToDesktop(win)
    })

    this.windows.set(slotId, win)
  }

  private scheduleSaveBounds(slotId: FenceSlotId, win: BrowserWindow): void {
    const existing = this.saveBoundsTimers.get(slotId)
    if (existing) clearTimeout(existing)
    this.saveBoundsTimers.set(
      slotId,
      setTimeout(() => {
        if (win.isDestroyed()) return
        const bounds = win.getBounds()
        this.repo.updateLayout(slotId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        })
      }, 300)
    )
  }
}

let manager: FenceWindowManager | null = null

export function getFenceWindowManager(): FenceWindowManager {
  if (!manager) {
    manager = new FenceWindowManager()
  }
  return manager
}

import { BrowserWindow, app, screen } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc-channels'
import type { WidgetDisplayMode, WidgetEdgeAnchor } from '@shared/widget-display'
import { defaultDisplayModeForKind, isTaskWidgetKind } from '@shared/widget-display'
import type { UpdateWidgetInstanceDto, UpdateWidgetSettingsDto, WidgetInstance, WidgetSettings } from '@shared/widget-notes'
import { widgetInstanceDisplayName } from '@shared/widget-notes'
import { WidgetInstanceRepository } from './db/widget-instance-repository'
import { WidgetNoteRepository } from './db/widget-note-repository'
import { getDatabase } from './db/database'
import {
  boundsForDisplayMode,
  detectNearestDockEdge,
  desiredStripAlongFromBounds,
  expandedBoundsFromInstance,
  expandedWindowBounds,
  peekExpandedBoundsNearStrip,
  resolveStripAlongEdge,
  stripAlongFromInstance,
  stripBoundsForEdge,
  stripDimensionsForLabel
} from './widget-display-layout'

/**
 * 挂件单窗口：拖近屏幕边缘 → 贴边细条；点击/悬浮/快捷键 → 恢复展开尺寸。
 * 展开宽高仅在手动手动 resize 时更新，贴边/展开循环不改变用户设定的尺寸。
 */
export class WidgetWindowManager {
  private readonly windows = new Map<string, BrowserWindow>()
  private readonly saveBoundsTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly edgeSnapTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly applyingBounds = new Set<string>()
  /** 贴边悬停临时展开的实例：收起时不把 peek 坐标写入 expandedX/Y */
  private readonly peekingIds = new Set<string>()
  /** peek 期间按光标是否仍在窗内决定收起（避免 drag 标题栏误触 mouseleave） */
  private readonly peekWatchTimers = new Map<string, ReturnType<typeof setInterval>>()
  private taskToggleCursor = 0

  private get instanceRepo(): WidgetInstanceRepository {
    return new WidgetInstanceRepository(getDatabase())
  }

  private get settingsRepo(): WidgetNoteRepository {
    return new WidgetNoteRepository(getDatabase())
  }

  listInstances(): WidgetInstance[] {
    return this.instanceRepo.list()
  }

  getInstance(id: string): WidgetInstance | null {
    return this.instanceRepo.find(id)
  }

  createInstance(dto: import('@shared/widget-notes').CreateWidgetInstanceDto): WidgetInstance {
    const instance = this.instanceRepo.create(dto)
    this.showInstance(instance.id, { focus: true })
    return this.instanceRepo.find(instance.id) ?? instance
  }

  updateInstance(id: string, dto: UpdateWidgetInstanceDto): WidgetInstance {
    const instance = this.instanceRepo.update(id, dto)
    const win = this.windows.get(id)
    if (win && !win.isDestroyed()) {
      if (dto.alwaysOnTop !== undefined) {
        win.setAlwaysOnTop(instance.alwaysOnTop, 'floating')
      }
      if (dto.displayMode !== undefined || dto.edgeAnchor !== undefined) {
        this.syncWindowToInstance(id, { focus: false })
      }
    }
    return instance
  }

  deleteInstance(id: string): void {
    this.destroyWindow(id)
    this.instanceRepo.delete(id)
  }

  getSettings(): WidgetSettings {
    return this.settingsRepo.getSettings()
  }

  updateSettings(dto: UpdateWidgetSettingsDto): WidgetSettings {
    return this.settingsRepo.updateSettings(dto)
  }

  isVisible(id?: string): boolean {
    if (id) {
      const win = this.windows.get(id)
      return !!win && !win.isDestroyed() && win.isVisible()
    }
    return [...this.windows.values()].some((win) => !win.isDestroyed() && win.isVisible())
  }

  show(id?: string): void {
    if (id) {
      this.expand(id)
      return
    }
    for (const instance of this.listInstances()) {
      if (instance.displayMode !== 'hidden') {
        this.showInstance(instance.id, { focus: false })
      }
    }
    const last = this.listInstances().at(-1)
    last && this.windows.get(last.id)?.focus()
  }

  hide(id?: string): void {
    if (id) {
      this.setDisplayMode(id, 'hidden')
      return
    }
    for (const instance of this.listInstances()) {
      this.setDisplayMode(instance.id, 'hidden')
    }
  }

  toggle(id?: string): void {
    if (id) {
      const instance = this.instanceRepo.find(id)
      if (!instance) return
      if (instance.displayMode !== 'expanded') {
        this.expand(id)
      }
      return
    }
    this.toggleTaskWidgets()
  }

  /**
   * 展开挂件。
   * @param options.peek 贴边悬停预览：就地展开，移开后应收起且不污染记忆位置
   */
  expand(id: string, options?: { peek?: boolean }): void {
    const instance = this.instanceRepo.find(id)
    if (!instance) return

    const win = this.ensureWindow(id)

    // 已展开且非 peek：固定当前位置（用于悬停预览后点击固定，避免跳回记忆坐标）
    if (instance.displayMode === 'expanded' && !options?.peek) {
      this.clearPeekState(id)
      win.show()
      win.focus()
      this.notifyDisplayMode(id, instance)
      return
    }

    const workArea = screen.getDisplayMatching(win.getBounds()).workArea
    const expanded = expandedBoundsFromInstance(instance)

    let bounds: Electron.Rectangle
    if (options?.peek && instance.displayMode === 'edge_tab') {
      const strip = win.getBounds()
      bounds = peekExpandedBoundsNearStrip(instance.edgeAnchor, strip, expanded, workArea)
      this.peekingIds.add(id)
      this.startPeekPointerWatch(id)
    } else {
      this.clearPeekState(id)
      bounds = expandedWindowBounds(expanded, workArea)
    }

    const updated = this.instanceRepo.update(id, {
      displayMode: 'expanded',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
      // peek 不改 expandedX/Y；正式展开也不在此处改记忆宽高，仅改当前窗位
    })

    this.applyWindowBounds(id, win, bounds, true)
    win.show()
    win.focus()
    this.notifyDisplayMode(id, updated)
  }

  collapse(id: string): void {
    const instance = this.instanceRepo.find(id)
    const win = this.windows.get(id)
    if (!instance || !win || win.isDestroyed() || instance.displayMode !== 'expanded') {
      this.clearPeekState(id)
      return
    }

    const wasPeeking = this.clearPeekState(id)
    const bounds = win.getBounds()
    const workArea = screen.getDisplayMatching(bounds).workArea
    const edge = detectNearestDockEdge(bounds, workArea) ?? instance.edgeAnchor
    this.dockToEdge(id, edge, bounds, { preserveExpandedMemory: wasPeeking })
  }

  setDisplayMode(id: string, mode: WidgetDisplayMode, options?: { focus?: boolean }): WidgetInstance {
    if (mode === 'hidden') {
      return this.hideInstance(id)
    }
    if (mode === 'expanded') {
      this.expand(id)
      return this.instanceRepo.find(id)!
    }
    return this.syncWindowToInstance(id, { focus: options?.focus ?? false })
  }

  toggleTaskWidgets(): void {
    const tasks = this.listInstances().filter((i) => isTaskWidgetKind(i.kind))
    if (tasks.length === 0) {
      this.show()
      return
    }

    const compact = tasks.filter((i) => i.displayMode === 'edge_tab' || i.displayMode === 'mini')
    if (compact.length > 0) {
      this.taskToggleCursor = this.taskToggleCursor % compact.length
      const target = compact[this.taskToggleCursor]
      this.taskToggleCursor += 1
      this.expand(target.id)
      return
    }

    const hidden = tasks.filter((i) => i.displayMode === 'hidden')
    if (hidden.length > 0) {
      this.expand(hidden[0].id)
    }
  }

  restoreOnStartup(): void {
    const settings = this.getSettings()
    if (!settings.openOnStartup) return
    for (const instance of this.listInstances()) {
      if (instance.displayMode === 'hidden') continue
      this.showInstance(instance.id, { focus: false })
    }
  }

  destroy(): void {
    for (const id of [...this.windows.keys()]) {
      this.destroyWindow(id)
    }
  }

  /** 拖近边缘时贴边（仅 expanded 状态触发） */
  private tryDockFromExpanded(instanceId: string): void {
    const instance = this.instanceRepo.find(instanceId)
    const win = this.windows.get(instanceId)
    if (!instance || !win || win.isDestroyed() || instance.displayMode !== 'expanded') {
      return
    }

    const bounds = win.getBounds()
    const workArea = screen.getDisplayMatching(bounds).workArea
    const edge = detectNearestDockEdge(bounds, workArea)
    if (!edge) return
    this.dockToEdge(instanceId, edge, bounds)
  }

  private dockToEdge(
    instanceId: string,
    anchor: WidgetEdgeAnchor,
    fromBounds: Electron.Rectangle,
    options?: { preserveExpandedMemory?: boolean }
  ): WidgetInstance {
    const instance = this.instanceRepo.find(instanceId)
    const win = this.windows.get(instanceId)
    if (!instance || !win || win.isDestroyed()) {
      throw new Error(`挂件实例不存在: ${instanceId}`)
    }

    const workArea = screen.getDisplayMatching(fromBounds).workArea
    const expanded = expandedBoundsFromInstance(instance)

    // 贴边前只同步展开位置，不改变用户设定的展开宽高
    // peek 收起时保留原记忆位置，避免把临时贴边展开坐标写进去
    const expandedPosition = options?.preserveExpandedMemory
      ? { x: expanded.x, y: expanded.y, width: expanded.width, height: expanded.height }
      : {
          x: fromBounds.x,
          y: fromBounds.y,
          width: expanded.width,
          height: expanded.height
        }

    const label = widgetInstanceDisplayName(instance)
    const dims = stripDimensionsForLabel(anchor, label)
    const stripAlongSize = anchor === 'top' || anchor === 'bottom' ? dims.width : dims.height
    const desiredAlong = desiredStripAlongFromBounds(anchor, fromBounds, stripAlongSize)
    const occupied = this.getOccupiedStripsOnEdge(anchor, instanceId)
    const alongEdge = resolveStripAlongEdge(anchor, desiredAlong, stripAlongSize, workArea, occupied)
    const strip = stripBoundsForEdge(anchor, { alongEdge, label }, workArea, dims)

    const updated = this.instanceRepo.update(instanceId, {
      displayMode: 'edge_tab',
      edgeAnchor: anchor,
      expandedX: expandedPosition.x,
      expandedY: expandedPosition.y,
      x: strip.x,
      y: strip.y,
      width: strip.width,
      height: strip.height
    })

    this.applyWindowBounds(instanceId, win, strip, false)
    win.show()
    this.notifyDisplayMode(instanceId, updated)
    return updated
  }

  private hideInstance(instanceId: string): WidgetInstance {
    this.clearPeekState(instanceId)
    const win = this.windows.get(instanceId)
    if (win && !win.isDestroyed()) {
      win.hide()
    }
    const updated = this.instanceRepo.update(instanceId, { displayMode: 'hidden' })
    this.notifyDisplayMode(instanceId, updated)
    return updated
  }

  private showInstance(instanceId: string, options: { focus: boolean }): void {
    const instance = this.instanceRepo.find(instanceId)
    if (!instance || instance.displayMode === 'hidden') return

    if (instance.displayMode === 'expanded') {
      this.expand(instanceId)
      if (!options.focus) {
        this.windows.get(instanceId)?.blur()
      }
      return
    }
    this.syncWindowToInstance(instanceId, options)
  }

  private syncWindowToInstance(instanceId: string, options: { focus: boolean }): WidgetInstance {
    const instance = this.instanceRepo.find(instanceId)
    if (!instance) {
      throw new Error(`挂件实例不存在: ${instanceId}`)
    }

    const win = this.ensureWindow(instanceId)
    const workArea = screen.getDisplayMatching(win.getBounds()).workArea
    const expanded = expandedBoundsFromInstance(instance)

    let bounds: Electron.Rectangle | null = null
    if (instance.displayMode === 'expanded') {
      bounds = expandedWindowBounds(expanded, workArea)
    } else if (instance.displayMode === 'edge_tab') {
      const label = widgetInstanceDisplayName(instance)
      const alongEdge = stripAlongFromInstance(instance.edgeAnchor, instance)
      bounds = stripBoundsForEdge(
        instance.edgeAnchor,
        { alongEdge, label },
        workArea,
        stripDimensionsForLabel(instance.edgeAnchor, label)
      )
    } else if (instance.displayMode === 'mini') {
      bounds = boundsForDisplayMode('mini', expanded, instance.edgeAnchor, workArea)
    }

    if (!bounds) {
      return this.hideInstance(instanceId)
    }

    const updated = this.instanceRepo.update(instanceId, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })

    this.applyWindowBounds(instanceId, win, bounds, instance.displayMode === 'expanded')
    win.show()
    if (options.focus) {
      win.focus()
    }
    this.notifyDisplayMode(instanceId, updated)
    return updated
  }

  private applyWindowBounds(
    instanceId: string,
    win: BrowserWindow,
    bounds: Electron.Rectangle,
    resizable: boolean
  ): void {
    this.applyingBounds.add(instanceId)
    win.setResizable(resizable)
    if (resizable) {
      win.setMinimumSize(280, 360)
    } else {
      win.setMinimumSize(bounds.width, bounds.height)
      win.setMaximumSize(bounds.width, bounds.height)
    }
    win.setBounds(bounds)
    if (!resizable) {
      win.setMaximumSize(10000, 10000)
    }
    setTimeout(() => this.applyingBounds.delete(instanceId), 80)
  }

  private notifyDisplayMode(instanceId: string, instance: WidgetInstance): void {
    const win = this.windows.get(instanceId)
    if (!win || win.isDestroyed()) return
    win.webContents.send(IPC.WIDGET_DISPLAY_MODE_CHANGED, instance)
  }

  private destroyWindow(id: string): void {
    this.clearPeekState(id)
    for (const map of [this.saveBoundsTimers, this.edgeSnapTimers]) {
      const timer = map.get(id)
      if (timer) {
        clearTimeout(timer)
        map.delete(id)
      }
    }
    this.applyingBounds.delete(id)
    const win = this.windows.get(id)
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
    this.windows.delete(id)
  }

  /** 结束 peek：停止光标监听并返回是否曾在 peek */
  private clearPeekState(id: string): boolean {
    this.stopPeekPointerWatch(id)
    return this.peekingIds.delete(id)
  }

  /**
   * peek 收起以屏幕光标相对窗口 bounds 为准。
   * 标题栏 -webkit-app-region:drag 会让渲染进程误报 mouseleave，不能依赖 DOM leave。
   */
  private startPeekPointerWatch(id: string): void {
    this.stopPeekPointerWatch(id)
    const startedAt = Date.now()
    let outsideSince: number | null = null

    this.peekWatchTimers.set(
      id,
      setInterval(() => {
        if (!this.peekingIds.has(id)) {
          this.stopPeekPointerWatch(id)
          return
        }
        // 展开瞬间给 DOM/窗口尺寸一点稳定时间
        if (Date.now() - startedAt < 400) return

        const win = this.windows.get(id)
        if (!win || win.isDestroyed()) {
          this.clearPeekState(id)
          return
        }

        if (this.isCursorInsideWindow(win)) {
          outsideSince = null
          return
        }

        if (outsideSince == null) {
          outsideSince = Date.now()
          return
        }
        if (Date.now() - outsideSince >= 180) {
          this.collapse(id)
        }
      }, 80)
    )
  }

  private stopPeekPointerWatch(id: string): void {
    const timer = this.peekWatchTimers.get(id)
    if (timer) {
      clearInterval(timer)
      this.peekWatchTimers.delete(id)
    }
  }

  private isCursorInsideWindow(win: BrowserWindow): boolean {
    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getBounds()
    return (
      cursor.x >= bounds.x &&
      cursor.x < bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y < bounds.y + bounds.height
    )
  }

  private scheduleEdgeSnapCheck(instanceId: string, win: BrowserWindow): void {
    const existing = this.edgeSnapTimers.get(instanceId)
    if (existing) clearTimeout(existing)

    this.edgeSnapTimers.set(
      instanceId,
      setTimeout(() => {
        this.edgeSnapTimers.delete(instanceId)
        if (this.applyingBounds.has(instanceId)) return
        const instance = this.instanceRepo.find(instanceId)
        if (!instance || instance.displayMode !== 'expanded') return
        this.tryDockFromExpanded(instanceId)
      }, 120)
    )
  }

  private ensureWindow(instanceId: string): BrowserWindow {
    const existing = this.windows.get(instanceId)
    if (existing && !existing.isDestroyed()) {
      return existing
    }

    const instance = this.instanceRepo.find(instanceId)
    if (!instance) {
      throw new Error(`挂件实例不存在: ${instanceId}`)
    }

    const win = new BrowserWindow({
      x: instance.x,
      y: instance.y,
      width: instance.width,
      height: instance.height,
      minWidth: 280,
      minHeight: 360,
      frame: false,
      transparent: false,
      resizable: instance.displayMode === 'expanded',
      skipTaskbar: true,
      alwaysOnTop: instance.alwaysOnTop,
      show: false,
      title: instance.name || '小柒todo 挂件',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/widget.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    const hash = `#${instanceId}`
    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/widget.html${hash}`)
    } else {
      void win.loadFile(join(__dirname, '../renderer/widget.html'), { hash: instanceId })
    }

    win.on('close', (event) => {
      if (!(app as typeof app & { isQuitting?: boolean }).isQuitting) {
        event.preventDefault()
        this.hideInstance(instanceId)
      }
    })

    win.on('moved', () => {
      if (this.applyingBounds.has(instanceId)) return
      const latest = this.instanceRepo.find(instanceId)
      if (latest?.displayMode === 'edge_tab') {
        this.scheduleSaveStripPosition(instanceId, win)
        return
      }
      // 悬停预览中用户开始拖动 → 视为固定展开，之后收起应记住新位置
      this.clearPeekState(instanceId)
      this.scheduleSavePosition(instanceId, win)
      this.scheduleEdgeSnapCheck(instanceId, win)
    })

    win.on('resized', () => {
      if (this.applyingBounds.has(instanceId)) return
      this.scheduleSaveExpandedBounds(instanceId, win)
    })

    win.webContents.on('did-finish-load', () => {
      const latest = this.instanceRepo.find(instanceId)
      if (latest) {
        this.notifyDisplayMode(instanceId, latest)
      }
    })

    this.windows.set(instanceId, win)
    return win
  }

  /** 贴边细条沿边缘拖动时保存位置 */
  private scheduleSaveStripPosition(instanceId: string, win: BrowserWindow): void {
    const instance = this.instanceRepo.find(instanceId)
    if (!instance || instance.displayMode !== 'edge_tab') return

    const existing = this.saveBoundsTimers.get(instanceId)
    if (existing) clearTimeout(existing)

    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const latest = this.instanceRepo.find(instanceId)
        if (!latest || latest.displayMode !== 'edge_tab') return

        const bounds = win.getBounds()
        const workArea = screen.getDisplayMatching(bounds).workArea
        const label = widgetInstanceDisplayName(latest)
        const dims = stripDimensionsForLabel(latest.edgeAnchor, label)
        const alongEdge = stripAlongFromInstance(latest.edgeAnchor, bounds)
        const strip = stripBoundsForEdge(
          latest.edgeAnchor,
          { alongEdge, label },
          workArea,
          dims
        )

        this.instanceRepo.update(instanceId, {
          x: strip.x,
          y: strip.y,
          width: strip.width,
          height: strip.height
        })

        if (bounds.x !== strip.x || bounds.y !== strip.y || bounds.width !== strip.width || bounds.height !== strip.height) {
          this.applyWindowBounds(instanceId, win, strip, false)
        }
      }, 200)
    )
  }

  private getOccupiedStripsOnEdge(
    anchor: WidgetEdgeAnchor,
    excludeId: string
  ): { along: number; size: number }[] {
    const horizontal = anchor === 'top' || anchor === 'bottom'
    return this.listInstances()
      .filter(
        (item) =>
          item.id !== excludeId && item.displayMode === 'edge_tab' && item.edgeAnchor === anchor
      )
      .map((item) => ({
        along: stripAlongFromInstance(anchor, item),
        size: horizontal ? item.width : item.height
      }))
  }

  /** 拖动时仅更新展开位置，不改变展开宽高 */
  private scheduleSavePosition(instanceId: string, win: BrowserWindow): void {
    const instance = this.instanceRepo.find(instanceId)
    if (!instance || instance.displayMode !== 'expanded') return

    const existing = this.saveBoundsTimers.get(instanceId)
    if (existing) clearTimeout(existing)

    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const bounds = win.getBounds()
        const expanded = expandedBoundsFromInstance(instance)
        this.instanceRepo.update(instanceId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          expandedX: bounds.x,
          expandedY: bounds.y,
          expandedWidth: expanded.width,
          expandedHeight: expanded.height
        })
      }, 200)
    )
  }

  /** 仅用户手动 resize 时更新展开宽高 */
  private scheduleSaveExpandedBounds(instanceId: string, win: BrowserWindow): void {
    const instance = this.instanceRepo.find(instanceId)
    if (!instance || instance.displayMode !== 'expanded') return

    const existing = this.saveBoundsTimers.get(instanceId)
    if (existing) clearTimeout(existing)

    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const bounds = win.getBounds()
        this.instanceRepo.update(instanceId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          expandedX: bounds.x,
          expandedY: bounds.y,
          expandedWidth: bounds.width,
          expandedHeight: bounds.height
        })
      }, 200)
    )
  }
}

let manager: WidgetWindowManager | null = null

export function getWidgetWindowManager(): WidgetWindowManager {
  if (!manager) {
    manager = new WidgetWindowManager()
  }
  return manager
}

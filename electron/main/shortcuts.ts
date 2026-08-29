import { BrowserWindow, globalShortcut } from 'electron'
import { IPC } from '@shared/ipc-channels'
import {
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
  type ShortcutBindings,
  isShortcutBound,
  toElectronAccelerator
} from '@shared/shortcuts'
import { readShortcutBindings } from './data-path'
import { getWidgetWindowManager } from './widget-window-manager'
import { getQuickCaptureWindowManager } from './quick-capture-window-manager'
import { toggleMainWindow } from './tray'

/** 当前已注册的 globalShortcut → 动作 ID，便于更新时先卸载 */
const registered = new Map<string, ShortcutActionId>()

export type GlobalShortcutHandlers = {
  onAction: (win: BrowserWindow, action: ShortcutActionId) => void
  onToggleWidget?: () => void
  onQuickCapture?: () => void
}

export function createDefaultShortcutHandlers(
  getMainWindow: () => BrowserWindow | null
): GlobalShortcutHandlers {
  return {
    onAction: (win, action) => {
      win.show()
      win.focus()
      win.webContents.send(IPC.APP_ACTION, action)
    },
    onToggleWidget: () => getWidgetWindowManager().toggle(),
    onQuickCapture: () => getQuickCaptureWindowManager().toggle()
  }
}

function sendAction(win: BrowserWindow, action: ShortcutActionId, handlers: GlobalShortcutHandlers): void {
  if (action === 'showWindow') {
    toggleMainWindow(win)
    return
  }
  if (action === 'toggleWidget') {
    handlers.onToggleWidget?.()
    return
  }
  if (action === 'quickCapture') {
    handlers.onQuickCapture?.()
    return
  }
  handlers.onAction(win, action)
}

/**
 * 注册需要在窗口隐藏时仍可触发的快捷键（如托盘模式下新建任务、显示窗口）。
 * 窗口聚焦时 Renderer 也会监听同一绑定，重复触发由动作处理器幂等处理。
 */
export function registerGlobalShortcuts(
  win: BrowserWindow,
  handlers: GlobalShortcutHandlers,
  bindings?: ShortcutBindings
): void {
  unregisterGlobalShortcuts()
  const map = bindings ?? readShortcutBindings()

  for (const def of SHORTCUT_ACTIONS) {
    if (!def.globalWhenHidden) continue
    const raw = map[def.id]
    if (!isShortcutBound(raw)) continue
    const electronAccel = toElectronAccelerator(raw)
    if (registered.has(electronAccel)) {
      console.warn(`[shortcuts] skip duplicate global accelerator: ${electronAccel}`)
      continue
    }
    const ok = globalShortcut.register(electronAccel, () => {
      sendAction(win, def.id, handlers)
    })
    if (ok) {
      registered.set(electronAccel, def.id)
    } else {
      console.warn(`[shortcuts] failed to register global: ${electronAccel}`)
    }
  }
}

export function unregisterGlobalShortcuts(): void {
  for (const accel of registered.keys()) {
    globalShortcut.unregister(accel)
  }
  registered.clear()
}

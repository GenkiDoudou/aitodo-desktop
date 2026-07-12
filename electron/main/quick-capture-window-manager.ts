import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc-channels'

const CAPTURE_WIDTH = 640
const CAPTURE_HEIGHT = 120

/** 全局快捷任务输入条：居中浮动、无边框 */
export class QuickCaptureWindowManager {
  private window: BrowserWindow | null = null
  private lastToggleAt = 0

  isVisible(): boolean {
    return !!this.window && !this.window.isDestroyed() && this.window.isVisible()
  }

  show(): void {
    const win = this.ensureWindow()
    this.centerWindow(win)
    win.show()
    win.focus()
    win.webContents.send(IPC.CAPTURE_FOCUS)
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  toggle(): void {
    const now = Date.now()
    if (now - this.lastToggleAt < 280) return
    this.lastToggleAt = now
    if (this.isVisible()) {
      this.hide()
    } else {
      this.show()
    }
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }

  private centerWindow(win: BrowserWindow): void {
    const display = screen.getPrimaryDisplay()
    const { width: sw, height: sh } = display.workAreaSize
    const { x: wx, y: wy } = display.workArea
    win.setBounds({
      x: wx + Math.round((sw - CAPTURE_WIDTH) / 2),
      y: wy + Math.round(sh * 0.2),
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    })
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window
    }

    const win = new BrowserWindow({
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: '快捷任务输入',
      autoHideMenuBar: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/capture.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/capture.html`)
    } else {
      void win.loadFile(join(__dirname, '../renderer/capture.html'))
    }

    win.on('blur', () => {
      setTimeout(() => {
        if (win.isDestroyed() || !win.isVisible()) return
        if (!win.isFocused()) {
          this.hide()
        }
      }, 120)
    })

    this.window = win
    return win
  }
}

let manager: QuickCaptureWindowManager | null = null

export function getQuickCaptureWindowManager(): QuickCaptureWindowManager {
  if (!manager) {
    manager = new QuickCaptureWindowManager()
  }
  return manager
}

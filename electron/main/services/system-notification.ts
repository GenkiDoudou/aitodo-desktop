import { app, BrowserWindow, Notification, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export const APP_NOTIFICATION_ID = 'com.aitodo.desktop'

/** Windows 通知依赖固定 AppUserModelId（须与 electron-builder appId 一致） */
export function registerNotificationSupport(): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_NOTIFICATION_ID)
  }
}

function notificationIcon() {
  const candidates = [
    join(process.resourcesPath, 'tray.png'),
    join(app.getAppPath(), 'resources', 'tray.png'),
    join(__dirname, '../../resources/tray.png')
  ]
  for (const iconPath of candidates) {
    if (!existsSync(iconPath)) continue
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) return image
  }
  return undefined
}

function flashMainWindow(): void {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  win?.flashFrame(true)
}

function showWithElectron(title: string, body: string): boolean {
  if (!Notification.isSupported()) {
    console.warn('[system-notification] Notification API not supported')
    return false
  }
  try {
    const notification = new Notification({
      title,
      body,
      icon: notificationIcon(),
      silent: false
    })
    notification.on('failed', (_event, error) => {
      console.error('[system-notification] Electron notification failed:', error)
    })
    notification.show()
    return true
  } catch (err) {
    console.error('[system-notification] Electron show failed', err)
    return false
  }
}

function showWithNodeNotifier(title: string, body: string): void {
  try {
    // Windows 开发/未安装场景下，SnoreToast 比 Electron Notification 更可靠
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifier = require('node-notifier') as {
      notify(options: { title: string; message: string; appID: string; wait: boolean }): void
    }
    notifier.notify({
      title,
      message: body,
      appID: APP_NOTIFICATION_ID,
      wait: false
    })
  } catch (err) {
    console.error('[system-notification] node-notifier failed, fallback to Electron', err)
    showWithElectron(title, body)
  }
}

/** 弹出系统级通知（Windows/macOS/Linux） */
export function showSystemNotification(title: string, body: string): void {
  const message = (body || title).trim().slice(0, 240)
  const heading = title.trim() || '小柒todo'

  if (process.platform === 'win32') {
    showWithNodeNotifier(heading, message)
    flashMainWindow()
    return
  }

  if (!showWithElectron(heading, message)) {
    flashMainWindow()
  }
}

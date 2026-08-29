import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'

/**
 * 解析用户真实「桌面」文件夹路径。
 * Windows 上 OneDrive 重定向时，需与资源管理器显示的桌面一致。
 */
export function resolveDesktopPath(): string {
  const candidates: string[] = []

  try {
    candidates.push(app.getPath('desktop'))
  } catch {
    // ignore
  }

  const home = os.homedir()
  candidates.push(path.join(home, 'Desktop'))

  const oneDrive = process.env.OneDrive
  if (oneDrive) {
    candidates.push(path.join(oneDrive, 'Desktop'))
  }
  const oneDriveConsumer = process.env.OneDriveConsumer
  if (oneDriveConsumer) {
    candidates.push(path.join(oneDriveConsumer, 'Desktop'))
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return path.normalize(p)
    }
  }

  return path.normalize(candidates[0] ?? path.join(home, 'Desktop'))
}

import { existsSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import type { InstallShape } from '@shared/app-update'

export interface InstallShapeDetectorInput {
  platform: NodeJS.Platform
  isPackaged: boolean
  execPath: string
}

/** 检测当前安装形态：mac / nsis / portable-dir */
export function detectInstallShape(input: InstallShapeDetectorInput): InstallShape {
  if (input.platform === 'darwin') return 'mac'
  if (input.platform !== 'win32') {
    // 非 Win/Mac 首版按 portable 目录语义处理（极少见）
    return 'portable-dir'
  }
  if (!input.isPackaged) {
    // 开发态仍报告 portable-dir，便于设置页展示；Orchestrator 会禁止自动下载
    return 'portable-dir'
  }
  return hasNsisUninstaller(dirname(input.execPath)) ? 'nsis' : 'portable-dir'
}

export function hasNsisUninstaller(appDir: string): boolean {
  if (!existsSync(appDir)) return false
  let names: string[] = []
  try {
    names = readdirSync(appDir)
  } catch {
    return false
  }
  return names.some(
    (name) =>
      /^Uninstall .+\.exe$/i.test(name) ||
      /^uninstall\.exe$/i.test(name) ||
      name.toLowerCase() === 'uninstall.exe'
  )
}

/** 应用根目录（exe 所在目录） */
export function resolveAppRootDir(execPath: string): string {
  return dirname(execPath)
}

export const PORTABLE_DATA_DIR_NAME = 'data'
export const PORTABLE_STAGING_DIR_NAME = '.aitodo-update-staging'
export const PORTABLE_PENDING_FILE_NAME = '.aitodo-update-pending.json'

export function portableStagingPath(appRoot: string): string {
  return join(dirname(appRoot), PORTABLE_STAGING_DIR_NAME)
}

export function portablePendingPath(appRoot: string): string {
  return join(appRoot, PORTABLE_PENDING_FILE_NAME)
}

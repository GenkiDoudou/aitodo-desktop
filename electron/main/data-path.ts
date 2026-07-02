import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const CONFIG_FILE = 'config.json'

interface DesktopConfig {
  /** 用户自定义数据目录；重启后生效 */
  dataDir?: string
}

/**
 * 平台默认数据目录（便携模式）：
 * - Windows：exe 同级 data/
 * - macOS：.app 包外并列 ai-todo-data/（bundle 内只读）
 */
export function getDefaultDataDir(): string {
  if (process.platform === 'darwin') {
    const exe = app.getPath('exe')
    return path.resolve(path.dirname(exe), '..', '..', '..', 'ai-todo-data')
  }
  return path.join(path.dirname(process.execPath), 'data')
}

function readConfigFrom(dir: string): DesktopConfig | null {
  const configPath = path.join(dir, CONFIG_FILE)
  if (!fs.existsSync(configPath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
  } catch {
    return null
  }
}

/**
 * 解析当前应使用的数据目录。
 * 优先顺序：默认目录 config 中的 dataDir → 默认目录本身。
 */
export function resolveDataDir(): string {
  const defaultDir = getDefaultDataDir()
  const cfg = readConfigFrom(defaultDir)
  if (cfg?.dataDir) {
    return cfg.dataDir
  }
  return defaultDir
}

/** 检测目录是否可写（用于启动与设置页） */
export function isDirectoryWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, '.write-test')
    fs.writeFileSync(probe, 'ok', 'utf-8')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

/**
 * 将新的数据目录写入当前数据目录下的 config.json。
 * v1 不自动搬迁文件，由 UI 提示用户手动复制后重启。
 */
export function savePendingDataDir(currentDir: string, newDir: string): void {
  if (!isDirectoryWritable(newDir)) {
    throw new Error('目标目录不可写')
  }
  fs.mkdirSync(currentDir, { recursive: true })
  const configPath = path.join(currentDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = { ...existing, dataDir: newDir }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

export function getDatabaseFilePath(dataDir: string): string {
  return path.join(dataDir, 'data.db')
}

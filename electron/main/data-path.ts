import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import type { ShortcutBindings } from '@shared/shortcuts'
import { mergeShortcutBindings } from '@shared/shortcuts'
import type { LlmConfig } from '@shared/llm-config'
import { mergeLlmConfig } from '@shared/llm-config'
import type { AiPromptConfig } from '@shared/ai-prompt-config'
import { mergeAiPromptConfig } from '@shared/ai-prompt-config'
import type { CloseBehavior } from '@shared/close-behavior'
import { mergeCloseBehavior } from '@shared/close-behavior'
import type { TaskActivityRetentionPolicy } from '@shared/types'
import { mergeTaskActivityRetention } from '@shared/task-activity-retention'

const CONFIG_FILE = 'config.json'

interface DesktopConfig {
  /** 用户自定义数据目录；重启后生效 */
  dataDir?: string
  /** 用户自定义快捷键；未配置项使用 shared/shortcuts 默认值 */
  shortcuts?: Partial<ShortcutBindings>
  /** 大模型 API 配置（本地存储） */
  llm?: Partial<LlmConfig>
  /** AI 一句话解析提示词 */
  aiPrompt?: Partial<AiPromptConfig>
  /** 关闭主窗口时的行为 */
  closeBehavior?: CloseBehavior
  /** 任务动态全局保留策略 */
  taskActivityRetention?: Partial<TaskActivityRetentionPolicy>
}

/**
 * 平台默认数据目录：
 * - **开发模式**（`npm run dev`）：`app.getPath('userData')/data`，持久保存，不随 node_modules 重装丢失
 * - **Windows 打包**：exe 同级 `data/`（便携）
 * - **macOS 打包**：`.app` 旁 `ai-todo-data/`
 */
export function getDefaultDataDir(): string {
  if (!app.isPackaged) {
    return path.join(app.getPath('userData'), 'data')
  }
  if (process.platform === 'darwin') {
    const exe = app.getPath('exe')
    return path.resolve(path.dirname(exe), '..', '..', '..', 'ai-todo-data')
  }
  return path.join(path.dirname(process.execPath), 'data')
}

/** 开发模式下旧版误写在 electron.exe 旁的数据库路径（仅用于一次性迁移） */
function getLegacyDevDataDir(): string {
  return path.join(path.dirname(process.execPath), 'data')
}

/**
 * 若新版 userData 库不存在、旧版 electron 旁库存在，则自动复制一次。
 */
export function migrateLegacyDevDatabaseIfNeeded(targetDir: string): void {
  if (app.isPackaged) {
    return
  }
  const targetDb = path.join(targetDir, 'data.db')
  if (fs.existsSync(targetDb)) {
    return
  }
  const legacyDb = path.join(getLegacyDevDataDir(), 'data.db')
  if (!fs.existsSync(legacyDb)) {
    return
  }
  fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(legacyDb, targetDb)
  console.log(`[aiTodo] 已从旧开发目录迁移数据库：${legacyDb} → ${targetDb}`)
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
  migrateLegacyDevDatabaseIfNeeded(defaultDir)
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

function readActiveConfig(): DesktopConfig {
  const defaultDir = getDefaultDataDir()
  return readConfigFrom(defaultDir) ?? {}
}

/** 读取当前生效的快捷键绑定（合并默认值） */
export function readShortcutBindings(): ShortcutBindings {
  const cfg = readActiveConfig()
  return mergeShortcutBindings(cfg.shortcuts)
}

/**
 * 持久化快捷键到 config.json（与 dataDir 同文件）。
 * 保存后立即由 shortcuts 模块重新注册 globalShortcut。
 */
export function saveShortcutBindings(bindings: ShortcutBindings): void {
  const defaultDir = getDefaultDataDir()
  fs.mkdirSync(defaultDir, { recursive: true })
  const configPath = path.join(defaultDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = { ...existing, shortcuts: bindings }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

/** 读取大模型配置（合并默认值） */
export function readLlmConfig(): LlmConfig {
  const cfg = readActiveConfig()
  return mergeLlmConfig(cfg.llm)
}

/** 持久化大模型配置到 config.json */
export function saveLlmConfig(config: LlmConfig): void {
  const defaultDir = getDefaultDataDir()
  fs.mkdirSync(defaultDir, { recursive: true })
  const configPath = path.join(defaultDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = { ...existing, llm: mergeLlmConfig(config) }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

/** 读取 AI 解析提示词（合并默认值） */
export function readAiPromptConfig(): AiPromptConfig {
  const cfg = readActiveConfig()
  return mergeAiPromptConfig(cfg.aiPrompt)
}

/** 持久化 AI 解析提示词 */
export function saveAiPromptConfig(config: AiPromptConfig): void {
  const defaultDir = getDefaultDataDir()
  fs.mkdirSync(defaultDir, { recursive: true })
  const configPath = path.join(defaultDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = { ...existing, aiPrompt: mergeAiPromptConfig(config) }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

/** 读取关闭主窗口行为 */
export function readCloseBehavior(): CloseBehavior {
  const cfg = readActiveConfig()
  return mergeCloseBehavior(cfg.closeBehavior)
}

/** 持久化关闭主窗口行为 */
export function saveCloseBehavior(behavior: CloseBehavior): void {
  const defaultDir = getDefaultDataDir()
  fs.mkdirSync(defaultDir, { recursive: true })
  const configPath = path.join(defaultDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = { ...existing, closeBehavior: mergeCloseBehavior(behavior) }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

/** 读取任务动态保留策略（合并默认值） */
export function readTaskActivityRetention(): TaskActivityRetentionPolicy {
  const cfg = readActiveConfig()
  return mergeTaskActivityRetention(cfg.taskActivityRetention)
}

/** 持久化任务动态保留策略 */
export function saveTaskActivityRetention(policy: TaskActivityRetentionPolicy): void {
  const defaultDir = getDefaultDataDir()
  fs.mkdirSync(defaultDir, { recursive: true })
  const configPath = path.join(defaultDir, CONFIG_FILE)
  let existing: DesktopConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DesktopConfig
    } catch {
      existing = {}
    }
  }
  const next: DesktopConfig = {
    ...existing,
    taskActivityRetention: mergeTaskActivityRetention(policy)
  }
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8')
}

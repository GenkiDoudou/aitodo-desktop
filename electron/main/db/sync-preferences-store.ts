import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mergeSyncPreferences,
  type SyncPreferences
} from '@shared/sync-preferences'

const FILE_NAME = 'sync-preferences.json'

export function readSyncPreferences(dataDir: string): SyncPreferences {
  const path = join(dataDir, FILE_NAME)
  // 允许缺省文件：首次启动/迁移场景下直接回落到默认偏好。
  if (!existsSync(path)) return mergeSyncPreferences()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SyncPreferences>
    // mergeSyncPreferences 会把未知字段与缺省字段统一回到默认结构，
    // 避免旧客户端/手工编辑导致的破坏性行为。
    return mergeSyncPreferences(raw)
  } catch {
    // JSON 解析失败时直接回落默认配置，保证同步不会因为本地文件损坏而彻底失效。
    return mergeSyncPreferences()
  }
}

export function writeSyncPreferences(dataDir: string, prefs: SyncPreferences): SyncPreferences {
  const merged = mergeSyncPreferences(prefs)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, FILE_NAME), JSON.stringify(merged, null, 2), 'utf8')
  return merged
}

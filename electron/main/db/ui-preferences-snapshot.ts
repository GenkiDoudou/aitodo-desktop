import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE_NAME = 'ui-preferences-snapshot.json'

/**
 * 渲染进程 UI 偏好快照（挂在 app_settings 载荷的 uiPreferences 字段）。
 * Main 在登录/配置变更时读此文件入队；Pull 应用后写回并广播给各窗口。
 * 只接受 string→string，忽略其它类型，避免脏 JSON 污染。
 */
export function readUiPreferencesSnapshot(dataDir: string): Record<string, string> {
  const path = join(dataDir, FILE_NAME)
  if (!existsSync(path)) return {}
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function writeUiPreferencesSnapshot(
  dataDir: string,
  prefs: Record<string, string>
): void {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, FILE_NAME), JSON.stringify(prefs, null, 2), 'utf8')
}

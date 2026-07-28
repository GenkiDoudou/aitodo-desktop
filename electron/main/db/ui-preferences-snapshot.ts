import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE_NAME = 'ui-preferences-snapshot.json'

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

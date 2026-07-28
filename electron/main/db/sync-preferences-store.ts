import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mergeSyncPreferences,
  type SyncPreferences
} from '@shared/sync-preferences'

const FILE_NAME = 'sync-preferences.json'

export function readSyncPreferences(dataDir: string): SyncPreferences {
  const path = join(dataDir, FILE_NAME)
  if (!existsSync(path)) return mergeSyncPreferences()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SyncPreferences>
    return mergeSyncPreferences(raw)
  } catch {
    return mergeSyncPreferences()
  }
}

export function writeSyncPreferences(dataDir: string, prefs: SyncPreferences): SyncPreferences {
  const merged = mergeSyncPreferences(prefs)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, FILE_NAME), JSON.stringify(merged, null, 2), 'utf8')
  return merged
}

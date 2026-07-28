import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'

export interface SyncCredentialsFile {
  accessToken: string
  userId: string
  username: string
  savedAt: string
}

export interface SyncStateRow {
  id: string
  deviceId: string
  userId: string | null
  serverBaseUrl: string | null
  lastPulledCursor: string | null
  lastPushedAt: string | null
  lastSyncAt: string | null
  lastError: string | null
  authExpiresAt: string | null
  updatedAt: string
}

function credentialsPath(dataDir: string): string {
  return join(dataDir, 'sync-credentials.json')
}

export function readSyncCredentials(dataDir: string): SyncCredentialsFile | null {
  const path = credentialsPath(dataDir)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as SyncCredentialsFile
    if (!raw?.accessToken || !raw?.userId) return null
    return raw
  } catch {
    return null
  }
}

export function writeSyncCredentials(dataDir: string, creds: SyncCredentialsFile): void {
  const path = credentialsPath(dataDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 })
}

export function clearSyncCredentials(dataDir: string): void {
  const path = credentialsPath(dataDir)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

interface SyncStateDbRow {
  id: string
  device_id: string
  user_id: string | null
  server_base_url: string | null
  last_pulled_cursor: string | null
  last_pushed_at: string | null
  last_sync_at: string | null
  last_error: string | null
  auth_expires_at: string | null
  updated_at: string
}

function mapState(row: SyncStateDbRow): SyncStateRow {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    serverBaseUrl: row.server_base_url,
    lastPulledCursor: row.last_pulled_cursor,
    lastPushedAt: row.last_pushed_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    authExpiresAt: row.auth_expires_at,
    updatedAt: row.updated_at
  }
}

/** 确保存在默认 sync_state 行并返回 */
export function ensureSyncState(db: Database.Database): SyncStateRow {
  const existing = db.prepare(`SELECT * FROM sync_state WHERE id = 'default'`).get() as
    | SyncStateDbRow
    | undefined
  if (existing) return mapState(existing)

  const ts = nowIso()
  const deviceId = uuidv4()
  db.prepare(
    `INSERT INTO sync_state (
      id, device_id, user_id, server_base_url, last_pulled_cursor,
      last_pushed_at, last_sync_at, last_error, auth_expires_at, updated_at
    ) VALUES ('default', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`
  ).run(deviceId, ts)
  return ensureSyncState(db)
}

export function updateSyncState(
  db: Database.Database,
  patch: Partial<Omit<SyncStateRow, 'id' | 'updatedAt'>>
): SyncStateRow {
  const current = ensureSyncState(db)
  const next: SyncStateRow = {
    ...current,
    deviceId: patch.deviceId ?? current.deviceId,
    userId: patch.userId !== undefined ? patch.userId : current.userId,
    serverBaseUrl: patch.serverBaseUrl !== undefined ? patch.serverBaseUrl : current.serverBaseUrl,
    lastPulledCursor:
      patch.lastPulledCursor !== undefined ? patch.lastPulledCursor : current.lastPulledCursor,
    lastPushedAt: patch.lastPushedAt !== undefined ? patch.lastPushedAt : current.lastPushedAt,
    lastSyncAt: patch.lastSyncAt !== undefined ? patch.lastSyncAt : current.lastSyncAt,
    lastError: patch.lastError !== undefined ? patch.lastError : current.lastError,
    authExpiresAt: patch.authExpiresAt !== undefined ? patch.authExpiresAt : current.authExpiresAt,
    updatedAt: nowIso()
  }
  db.prepare(
    `UPDATE sync_state SET
      device_id = ?, user_id = ?, server_base_url = ?, last_pulled_cursor = ?,
      last_pushed_at = ?, last_sync_at = ?, last_error = ?, auth_expires_at = ?, updated_at = ?
     WHERE id = 'default'`
  ).run(
    next.deviceId,
    next.userId,
    next.serverBaseUrl,
    next.lastPulledCursor,
    next.lastPushedAt,
    next.lastSyncAt,
    next.lastError,
    next.authExpiresAt,
    next.updatedAt
  )
  return next
}

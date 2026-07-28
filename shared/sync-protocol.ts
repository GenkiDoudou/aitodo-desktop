/** 桌面 ↔ Sync Server 增量同步契约（方案 A Outbox） */

export const SYNC_ENTITY_TYPES = [
  'category',
  'task',
  'task_reminder',
  'tag',
  'task_tag',
  'widget_note',
  'app_settings',
  'task_view',
  'scheduled_summary'
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]

export type SyncOperation = 'upsert' | 'delete'

export type SyncOutboxStatus = 'pending' | 'pushed' | 'discarded' | 'rejected'

export interface SyncChangeEnvelope {
  clientChangeId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  /** 与桌面 shared/types 对齐的 camelCase 载荷 */
  payload: Record<string, unknown>
  clientUpdatedAt: string
  clientSyncVersion: number
}

export interface SyncPushRequest {
  deviceId: string
  changes: SyncChangeEnvelope[]
}

export interface SyncPushRejected {
  clientChangeId: string
  reason: string
  message: string
}

export interface SyncPushConflict {
  clientChangeId: string
  entityType: SyncEntityType
  entityId: string
  serverPayload: Record<string, unknown>
  serverUpdatedAt: string
  serverRevision: number
}

export interface SyncPushResponse {
  accepted: string[]
  rejected: SyncPushRejected[]
  conflicts: SyncPushConflict[]
  serverTime: string
  cursorHint?: string
}

export interface SyncPullChange {
  revision: number
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown>
  serverUpdatedAt: string
  originDeviceId: string | null
}

export interface SyncPullResponse {
  changes: SyncPullChange[]
  nextCursor: string
  hasMore: boolean
}

export interface SyncStatusResponse {
  userId: string
  latestCursor: string
  serverTime: string
}

export interface SyncLoginRequest {
  username: string
  password: string
}

export interface SyncLoginResponse {
  accessToken: string
  userId: string
  username: string
}

import type { SyncPreferences } from './sync-preferences'

/** 设置页展示的同步状态（桌面侧） */
export interface DesktopSyncStatus {
  loggedIn: boolean
  username: string | null
  serverBaseUrl: string
  deviceId: string
  lastPulledCursor: string | null
  lastSyncAt: string | null
  lastError: string | null
  pendingCount: number
  preferences: SyncPreferences
}

export interface SyncTestServerResult {
  ok: boolean
  message: string
}

export function isSyncEntityType(value: string): value is SyncEntityType {
  return (SYNC_ENTITY_TYPES as readonly string[]).includes(value)
}

export function isSyncOperation(value: string): value is SyncOperation {
  return value === 'upsert' || value === 'delete'
}

/** 校验 Push 单条变更；非法返回错误文案，合法返回 null */
export function validateSyncChangeEnvelope(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'change must be an object'
  const c = raw as Record<string, unknown>
  if (typeof c.clientChangeId !== 'string' || !c.clientChangeId.trim()) {
    return 'clientChangeId required'
  }
  if (typeof c.entityType !== 'string' || !isSyncEntityType(c.entityType)) {
    return 'invalid entityType'
  }
  if (typeof c.entityId !== 'string' || !c.entityId.trim()) {
    return 'entityId required'
  }
  if (typeof c.operation !== 'string' || !isSyncOperation(c.operation)) {
    return 'invalid operation'
  }
  if (!c.payload || typeof c.payload !== 'object') {
    return 'payload required'
  }
  if (typeof c.clientUpdatedAt !== 'string' || !c.clientUpdatedAt.trim()) {
    return 'clientUpdatedAt required'
  }
  if (typeof c.clientSyncVersion !== 'number' || !Number.isFinite(c.clientSyncVersion)) {
    return 'clientSyncVersion required'
  }
  return null
}

/**
 * LWW：比较 ISO `yyyy-MM-ddTHH:mm:ss`（本地格式）或带 Z 的时间。
 * 返回 >0 表示 a 更新，<0 表示 b 更新，0 表示相等。
 */
export function compareUpdatedAt(a: string, b: string): number {
  return a.localeCompare(b)
}

/** 冲突判定：本地是否被服务端版本击败（服务端更新或时间相等） */
export function isServerWinningConflict(
  clientUpdatedAt: string,
  serverUpdatedAt: string
): boolean {
  return compareUpdatedAt(serverUpdatedAt, clientUpdatedAt) >= 0
}

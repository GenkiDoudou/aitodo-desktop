/**
 * 桌面 ↔ Sync Server 增量同步契约（方案 A：本地 Outbox）。
 * 1) 业务写库时同事务写入 local_changes（pending）；
 * 2) SyncEngine.push 批量上传，按 accepted/rejected/conflicts 更新状态；
 * 3) SyncEngine.pull 按 cursor 拉 changelog，经 sync-apply 写入本机。
 *
 * 实体类型与设置页开关的映射见 sync-entity-filter.ts。
 */

import type { SyncPreferences } from './sync-preferences'

export const SYNC_ENTITY_TYPES = [
  'category',
  'task',
  'task_reminder',
  'tag',
  'task_tag',
  'widget_note',
  'app_settings',
  'task_view',
  'scheduled_summary',
  'app_message'
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]

export type SyncOperation = 'upsert' | 'delete'

/** Outbox 行状态：见 SyncOutbox 类注释 */
export type SyncOutboxStatus = 'pending' | 'pushed' | 'discarded' | 'rejected'

/** 生产默认同步基址；本地联调请改为 quickboot，例如 http://127.0.0.1:9994 */
export const DEFAULT_SYNC_SERVER_URL = 'https://aitodo.126w.com'

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
  /** 产生该变更的设备；与本机 deviceId 相同且版本不新时可作回声过滤 */
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

/** 桌面自注册请求（字段与 quickboot POST /register 对齐） */
export interface SyncRegisterRequest {
  username: string
  password: string
  email: string
  phonenumber?: string
}

export interface SyncLoginResponse {
  accessToken: string
  userId: string
  username: string
}

/** 登录/注册遇本机未归属数据时的处理策略 */
export type SyncLoginDataPolicy = 'clear' | 'merge' | 'cancel'

/** 本机 Todo 数据摘要（设置页弹窗） */
export interface LocalSyncDataSummary {
  taskCount: number
  categoryCount: number
  noteCount: number
}

/**
 * 登录/注册 IPC 结果：
 * - completed：已写凭证并完成（或跳过）首次同步
 * - needs_data_policy：已验票成功，待用户选择合并/清空/取消
 * - cancelled：用户取消登录，未写凭证
 */
export type SyncAuthResult =
  | { kind: 'completed'; data: SyncLoginResponse }
  | { kind: 'needs_data_policy'; summary: LocalSyncDataSummary; username: string }
  | { kind: 'cancelled' }

export interface SyncCompleteLoginRequest {
  policy: SyncLoginDataPolicy
}

/** 设置页展示的同步状态（桌面侧聚合，非服务端原样） */
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

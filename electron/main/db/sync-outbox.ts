import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { nowIso } from '@shared/datetime'
import type { SyncEntityType, SyncOperation, SyncOutboxStatus } from '@shared/sync-protocol'

export interface LocalChangeRow {
  id: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown>
  clientSyncVersion: number
  createdAt: string
  pushedAt: string | null
  status: SyncOutboxStatus
}

interface LocalChangeDbRow {
  id: string
  entity_type: string
  entity_id: string
  operation: string
  payload_json: string
  client_sync_version: number
  created_at: string
  pushed_at: string | null
  status: string
}

function mapRow(row: LocalChangeDbRow): LocalChangeRow {
  return {
    id: row.id,
    entityType: row.entity_type as SyncEntityType,
    entityId: row.entity_id,
    operation: row.operation as SyncOperation,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    clientSyncVersion: row.client_sync_version,
    createdAt: row.created_at,
    pushedAt: row.pushed_at,
    status: row.status as SyncOutboxStatus
  }
}

export interface SyncOutboxRecordInput {
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown>
  clientSyncVersion: number
}

/**
 * 本地出站队列：与业务写同事务入队，供 SyncEngine Push。
 *
 * local_changes 表里保存的不是“最终业务数据”，而是“待推送的变更快照”。
 * 状态含义：
 * - pending：等待 push
 * - pushed：服务端已接收
 * - rejected：服务端显式拒绝（重试无意义）
 * - discarded：冲突时丢弃本地变更
 */
export class SyncOutbox {
  constructor(private readonly db: Database.Database) {}

  runInTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  record(input: SyncOutboxRecordInput): string {
    // record 由业务层/服务层在写入主库的同事务中调用，保证“数据写入 & outbox 入队”一致。
    // 返回 id 仅用于上层追踪/冲突回写，不要求可读语义。
    const id = uuidv4()
    const ts = nowIso()
    this.db
      .prepare(
        `INSERT INTO local_changes (
          id, entity_type, entity_id, operation, payload_json,
          client_sync_version, created_at, pushed_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`
      )
      .run(
        id,
        input.entityType,
        input.entityId,
        input.operation,
        JSON.stringify(input.payload),
        input.clientSyncVersion,
        ts
      )
    return id
  }

  listPending(limit = 200): LocalChangeRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM local_changes
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(limit) as LocalChangeDbRow[]
    return rows.map(mapRow)
  }

  /** 仅列出指定实体类型的 pending（避免关闭同步的类型堵死队列） */
  listPendingOfTypes(entityTypes: SyncEntityType[], limit = 200): LocalChangeRow[] {
    if (!entityTypes.length) return []
    const placeholders = entityTypes.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT * FROM local_changes
         WHERE status = 'pending' AND entity_type IN (${placeholders})
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(...entityTypes, limit) as LocalChangeDbRow[]
    return rows.map(mapRow)
  }

  countPending(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM local_changes WHERE status = 'pending'`)
      .get() as { cnt: number }
    return row.cnt
  }

  /** 是否已有待推送或曾成功推送的记录（存量补齐时跳过） */
  hasPendingOrPushed(entityType: SyncEntityType, entityId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 as ok FROM local_changes
         WHERE entity_type = ? AND entity_id = ? AND status IN ('pending', 'pushed')
         LIMIT 1`
      )
      .get(entityType, entityId) as { ok: number } | undefined
    return Boolean(row)
  }

  /**
   * 作废某实体的 pending/pushed 记录，便于换账号后强制重新入队推送。
   * discarded/rejected 不动。
   */
  discardPendingOrPushed(entityType: SyncEntityType, entityId: string): void {
    this.db
      .prepare(
        `UPDATE local_changes
         SET status = 'discarded'
         WHERE entity_type = ? AND entity_id = ? AND status IN ('pending', 'pushed')`
      )
      .run(entityType, entityId)
  }

  markStatus(id: string, status: Exclude<SyncOutboxStatus, 'pending'>, pushedAt?: string): void {
    const ts = pushedAt ?? (status === 'pushed' ? nowIso() : null)
    this.db
      .prepare(
        `UPDATE local_changes
         SET status = ?, pushed_at = COALESCE(?, pushed_at)
         WHERE id = ?`
      )
      .run(status, ts, id)
  }

  markMany(ids: string[], status: Exclude<SyncOutboxStatus, 'pending'>): void {
    const stmt = this.db.prepare(
      `UPDATE local_changes
       SET status = ?, pushed_at = CASE WHEN ? = 'pushed' THEN ? ELSE pushed_at END
       WHERE id = ?`
    )
    const ts = nowIso()
    const run = this.db.transaction((list: string[]) => {
      for (const id of list) {
        stmt.run(status, status, ts, id)
      }
    })
    run(ids)
  }
}

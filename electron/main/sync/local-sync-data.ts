import type Database from 'better-sqlite3'

/** 本机可同步 Todo 数据摘要（用于登录前弹窗文案） */
export interface LocalSyncDataSummary {
  taskCount: number
  categoryCount: number
  noteCount: number
}

function scalarCount(db: Database.Database, sql: string): number {
  const row = db.prepare(sql).get() as { cnt: number } | undefined
  return row?.cnt ?? 0
}

/** 本机是否存在可同步的 Todo 业务数据（未删除任务/分类/便签；不含默认视图种子） */
export function hasLocalSyncableData(db: Database.Database): boolean {
  const tasks = scalarCount(db, `SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL`)
  if (tasks > 0) return true
  const categories = scalarCount(db, `SELECT COUNT(*) as cnt FROM categories WHERE deleted_at IS NULL`)
  if (categories > 0) return true
  const notes = scalarCount(db, `SELECT COUNT(*) as cnt FROM widget_notes`)
  return notes > 0
}

/** 统计摘要供设置页弹窗展示 */
export function getLocalSyncDataSummary(db: Database.Database): LocalSyncDataSummary {
  return {
    taskCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL`),
    categoryCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM categories WHERE deleted_at IS NULL`),
    noteCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM widget_notes`)
  }
}

/**
 * 是否需在登录/注册成功后弹窗让用户选择数据策略。
 * 同一 userId 再次登录且本机仍有数据时不打扰（沿用增量/全量对账）。
 */
export function shouldPromptLocalDataPolicy(
  db: Database.Database,
  previousUserId: string | null,
  newUserId: string
): boolean {
  if (!hasLocalSyncableData(db)) {
    return false
  }
  if (previousUserId != null && previousUserId === newUserId) {
    return false
  }
  return true
}

/**
 * 清空本机 Todo 业务数据与同步 outbox，保留 deviceId / serverUrl。
 * 用于「仅使用当前账号云端数据」策略。
 */
export function clearLocalSyncData(db: Database.Database): void {
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM task_tags`).run()
    db.prepare(`DELETE FROM task_reminders`).run()
    db.prepare(`DELETE FROM task_activities`).run()
    db.prepare(`DELETE FROM tasks`).run()
    db.prepare(`DELETE FROM tags`).run()
    db.prepare(`DELETE FROM kanban_groups`).run()
    db.prepare(`DELETE FROM categories`).run()
    db.prepare(`DELETE FROM task_views`).run()
    db.prepare(`DELETE FROM scheduled_summaries`).run()
    db.prepare(`DELETE FROM app_messages`).run()
    db.prepare(`DELETE FROM widget_notes`).run()
    db.prepare(`DELETE FROM local_changes`).run()
    db.prepare(`DELETE FROM sync_conflicts`).run()
    db.prepare(
      `UPDATE sync_state SET
        last_pulled_cursor = NULL,
        last_pushed_at = NULL,
        last_sync_at = NULL,
        last_error = NULL
       WHERE id = 'default'`
    ).run()
  })
  run()
}

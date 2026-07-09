import type Database from 'better-sqlite3'
import { nowIso } from '@shared/datetime'

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        category_id TEXT,
        parent_id TEXT,
        due_at TEXT,
        remind_at TEXT,
        remind_fired_at TEXT,
        completed_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 4;
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS kanban_groups (
        id TEXT PRIMARY KEY,
        scope_key TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kanban_groups_scope ON kanban_groups(scope_key);
      ALTER TABLE tasks ADD COLUMN kanban_group_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_kanban_group ON tasks(kanban_group_id);
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS app_messages (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        task_id TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_app_messages_kind ON app_messages(kind);
      CREATE INDEX IF NOT EXISTS idx_app_messages_created ON app_messages(created_at);
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS task_reminders (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        fired_at TEXT,
        offset_minutes INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_reminders_at ON task_reminders(remind_at);
      CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON task_reminders(task_id);
      ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
      ALTER TABLE tasks ADD COLUMN remind_continuous INTEGER NOT NULL DEFAULT 0;
      INSERT INTO task_reminders (id, task_id, remind_at, fired_at, offset_minutes, created_at)
      SELECT
        lower(hex(randomblob(16))),
        id,
        remind_at,
        remind_fired_at,
        NULL,
        updated_at
      FROM tasks
      WHERE remind_at IS NOT NULL AND deleted_at IS NULL;
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS scheduled_summaries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_ids TEXT NOT NULL DEFAULT '[]',
        schedule_type TEXT NOT NULL,
        send_time TEXT NOT NULL,
        send_weekday INTEGER,
        send_day INTEGER,
        use_llm INTEGER NOT NULL DEFAULT 0,
        prompt_text TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_summaries_enabled ON scheduled_summaries(enabled);
    `
  },
  {
    version: 7,
    sql: `
      ALTER TABLE scheduled_summaries ADD COLUMN report_config TEXT;
    `
  },
  {
    version: 8,
    sql: `
      ALTER TABLE app_messages ADD COLUMN source TEXT;
    `
  },
  {
    version: 9,
    sql: `
      ALTER TABLE tasks ADD COLUMN completed_occurrence_dates TEXT;
    `
  },
  {
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS task_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_filters_sort ON task_filters(sort_order);
    `
  },
  {
    version: 11,
    sql: `
      CREATE TABLE IF NOT EXISTS task_activities (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_activities_task_created
        ON task_activities(task_id, created_at DESC);
    `
  },
  {
    version: 12,
    sql: `
      DROP TABLE IF EXISTS task_filters;
      CREATE TABLE IF NOT EXISTS task_views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        scope_key TEXT,
        filter_rule_json TEXT,
        group_by TEXT NOT NULL,
        sort_by TEXT NOT NULL,
        kanban_board_mode TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_views_sort ON task_views(sort_order);
      INSERT INTO task_views (
        id, name, layout, scope_key, filter_rule_json, group_by, sort_by,
        kanban_board_mode, sort_order, created_at, updated_at
      ) VALUES
        (
          'view-default-all', '全部任务', 'list', NULL, NULL,
          'none', 'custom', NULL, 0,
          datetime('now'), datetime('now')
        ),
        (
          'view-default-kanban', '看板', 'kanban', NULL,
          '{"type":"group","op":"and","children":[{"type":"cond","field":"status","op":"in","value":["TODO","IN_PROGRESS"]}]}',
          'none', 'custom', 'status', 1,
          datetime('now'), datetime('now')
        );
    `
  }
]

/** 按版本号顺序执行未应用的迁移（事务内） */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  )

  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue
    }
    const apply = db.transaction(() => {
      db.exec(migration.sql)
      insert.run(migration.version, nowIso())
    })
    apply()
  }
}

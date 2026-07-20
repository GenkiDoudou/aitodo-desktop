import type Database from 'better-sqlite3'
import { nowIso } from '@shared/datetime'
import { migrateLegacyTaskTags } from './tag-repository'

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
  },
  {
    version: 13,
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    `
  },
  {
    version: 14,
    sql: `
      ALTER TABLE tasks ADD COLUMN start_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_start_at ON tasks(start_at);
    `
  },
  {
    version: 15,
    sql: `
      ALTER TABLE categories ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 16,
    sql: `
      CREATE TABLE IF NOT EXISTS desktop_organize_settings (
        id                   TEXT PRIMARY KEY DEFAULT 'default',
        folder_prefix        TEXT NOT NULL DEFAULT '小柒整理-',
        layout_mode          TEXT NOT NULL DEFAULT 'flat_prefix',
        auto_organize_on_scan INTEGER NOT NULL DEFAULT 0,
        auto_scan_on_boot    INTEGER NOT NULL DEFAULT 1,
        updated_at           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_categories (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        target_folder_name TEXT NOT NULL,
        icon               TEXT NOT NULL DEFAULT '📁',
        color              TEXT NOT NULL DEFAULT '#dbeafe',
        sort_order         INTEGER NOT NULL DEFAULT 0,
        enabled            INTEGER NOT NULL DEFAULT 1,
        is_system          INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_category_rules (
        id          TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES desktop_categories(id) ON DELETE CASCADE,
        rule_type   TEXT NOT NULL,
        rule_json   TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS desktop_manual_assignments (
        item_path   TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_organize_snapshots (
        id           TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );

      INSERT INTO desktop_organize_settings (id, folder_prefix, layout_mode, auto_organize_on_scan, auto_scan_on_boot, updated_at)
      VALUES ('default', '小柒整理-', 'flat_prefix', 0, 1, datetime('now'));

      INSERT INTO desktop_categories (id, name, target_folder_name, icon, color, sort_order, enabled, is_system, created_at, updated_at) VALUES
        ('cat-docs', '文档', '文档', '📄', '#dbeafe', 100, 1, 0, datetime('now'), datetime('now')),
        ('cat-images', '图片', '图片', '🖼️', '#fce7f3', 110, 1, 0, datetime('now'), datetime('now')),
        ('file', '文件', '文件', '📄', '#f3f4f6', 200, 1, 1, datetime('now'), datetime('now')),
        ('folder', '文件夹', '文件夹', '📁', '#fef3c7', 210, 1, 1, datetime('now'), datetime('now')),
        ('icon', '图标', '图标', '🔗', '#e0e7ff', 220, 1, 1, datetime('now'), datetime('now')),
        ('uncategorized', '未分类', '未分类', '❓', '#fee2e2', 230, 1, 1, datetime('now'), datetime('now'));

      INSERT INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES
        ('rule-docs-ext', 'cat-docs', 'extension', '{"type":"extension","values":[".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx"]}', 0),
        ('rule-images-ext', 'cat-images', 'extension', '{"type":"extension","values":[".png",".jpg",".jpeg",".gif",".webp",".bmp"]}', 0),
        ('rule-file-kind', 'file', 'kind', '{"type":"kind","value":"file"}', 0),
        ('rule-folder-kind', 'folder', 'kind', '{"type":"kind","value":"folder"}', 0),
        ('rule-icon-kind', 'icon', 'kind', '{"type":"kind","value":"icon"}', 0);
    `
  },
  {
    version: 17,
    sql: `
      CREATE TABLE IF NOT EXISTS widget_settings (
        id               TEXT PRIMARY KEY DEFAULT 'default',
        x                INTEGER NOT NULL DEFAULT 200,
        y                INTEGER NOT NULL DEFAULT 200,
        width            INTEGER NOT NULL DEFAULT 320,
        height           INTEGER NOT NULL DEFAULT 420,
        always_on_top    INTEGER NOT NULL DEFAULT 1,
        open_on_startup  INTEGER NOT NULL DEFAULT 0,
        last_tab         TEXT NOT NULL DEFAULT 'notes',
        updated_at       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS widget_notes (
        id         TEXT PRIMARY KEY,
        content    TEXT NOT NULL DEFAULT '',
        color      TEXT NOT NULL DEFAULT 'yellow',
        pinned     INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO widget_settings (id, x, y, width, height, always_on_top, open_on_startup, last_tab, updated_at)
      VALUES ('default', 200, 200, 320, 420, 1, 0, 'notes', datetime('now'));
    `
  },
  {
    version: 18,
    sql: `
      CREATE TABLE IF NOT EXISTS desktop_fence_settings (
        id                   TEXT PRIMARY KEY DEFAULT 'default',
        fences_enabled       INTEGER NOT NULL DEFAULT 0,
        fences_always_on_top INTEGER NOT NULL DEFAULT 1,
        updated_at           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_fence_layout (
        category_id  TEXT PRIMARY KEY,
        x            INTEGER NOT NULL DEFAULT 100,
        y            INTEGER NOT NULL DEFAULT 100,
        width        INTEGER NOT NULL DEFAULT 300,
        height       INTEGER NOT NULL DEFAULT 280,
        visible      INTEGER NOT NULL DEFAULT 1,
        updated_at   TEXT NOT NULL
      );

      INSERT INTO desktop_fence_settings (id, fences_enabled, fences_always_on_top, updated_at)
      VALUES ('default', 0, 1, datetime('now'));
    `
  },
  {
    version: 19,
    sql: `
      ALTER TABLE desktop_fence_settings ADD COLUMN hide_native_icons INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    version: 20,
    sql: `
      UPDATE desktop_fence_settings SET hide_native_icons = 0;
    `
  },
  {
    version: 21,
    sql: `
      UPDATE desktop_fence_settings SET fences_always_on_top = 0;
    `
  },
  {
    version: 22,
    sql: `
      DELETE FROM desktop_fence_layout;
      INSERT INTO desktop_fence_layout (category_id, x, y, width, height, visible, updated_at)
      VALUES
        ('slot-apps', 16, 16, 300, 720, 1, datetime('now')),
        ('slot-folders', 1200, 16, 300, 200, 1, datetime('now')),
        ('slot-files', 1200, 228, 300, 508, 1, datetime('now'));
    `
  },
  {
    version: 23,
    sql: `
      DELETE FROM desktop_fence_layout
        WHERE category_id NOT IN ('slot-apps', 'slot-folders', 'slot-files');
      ALTER TABLE desktop_fence_settings ADD COLUMN layout_dimension_version INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    version: 24,
    sql: `
      ALTER TABLE desktop_organize_settings ADD COLUMN auto_organize_on_boot INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE desktop_organize_settings ADD COLUMN auto_organize_on_new_icons INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS desktop_custom_rules (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        match_type  TEXT NOT NULL,
        match_value TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES desktop_categories(id) ON DELETE CASCADE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      INSERT OR IGNORE INTO desktop_categories (id, name, target_folder_name, icon, color, sort_order, enabled, is_system, created_at, updated_at) VALUES
        ('cat-compress', '压缩', '压缩', '🗜️', '#e0e7ff', 105, 1, 0, datetime('now'), datetime('now')),
        ('cat-video', '视频', '视频', '🎬', '#fce7f3', 115, 0, 0, datetime('now'), datetime('now')),
        ('cat-audio', '音频', '音频', '🎵', '#fef3c7', 116, 0, 0, datetime('now'), datetime('now'));

      UPDATE desktop_category_rules SET rule_json = '{"type":"extension","values":[".txt",".pdf",".doc",".docx",".ppt",".pptx",".xls",".xlsx",".md",".rtf"]}' WHERE id = 'rule-docs-ext';
      UPDATE desktop_category_rules SET rule_json = '{"type":"extension","values":[".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg",".psd",".ico"]}' WHERE id = 'rule-images-ext';

      INSERT OR IGNORE INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES
        ('rule-compress-ext', 'cat-compress', 'extension', '{"type":"extension","values":[".zip",".rar",".7z",".dmg",".gz",".tar",".001",".apk",".iso"]}', 0),
        ('rule-video-ext', 'cat-video', 'extension', '{"type":"extension","values":[".mp4",".avi",".mov",".flv",".mkv",".wmv",".webm",".m4v"]}', 0),
        ('rule-audio-ext', 'cat-audio', 'extension', '{"type":"extension","values":[".mp3",".wav",".flac",".aac",".wma",".m4a",".ogg"]}', 0),
        ('rule-icon-lnk', 'icon', 'extension', '{"type":"extension","values":[".lnk"]}', 0);

      DELETE FROM desktop_category_rules WHERE id = 'rule-icon-kind';
    `
  },
  {
    version: 25,
    sql: `
      ALTER TABLE tasks ADD COLUMN triaged_at TEXT NULL;
      UPDATE tasks SET triaged_at = updated_at WHERE triaged_at IS NULL;
    `
  },
  {
    version: 26,
    sql: `
      ALTER TABLE task_views ADD COLUMN quadrant_options_json TEXT NULL;
    `
  },
  {
    version: 27,
    sql: `
      CREATE TABLE IF NOT EXISTS widget_instances (
        id            TEXT PRIMARY KEY,
        kind          TEXT NOT NULL,
        view_id       TEXT NULL,
        name          TEXT NOT NULL DEFAULT '',
        x             INTEGER NOT NULL DEFAULT 200,
        y             INTEGER NOT NULL DEFAULT 200,
        width         INTEGER NOT NULL DEFAULT 320,
        height        INTEGER NOT NULL DEFAULT 420,
        always_on_top INTEGER NOT NULL DEFAULT 1,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      INSERT INTO widget_instances (
        id, kind, view_id, name, x, y, width, height, always_on_top, sort_order, created_at, updated_at
      )
      SELECT
        'widget-default',
        CASE
          WHEN last_tab = 'matrix' THEN 'matrix'
          ELSE 'notes'
        END,
        NULL,
        CASE
          WHEN last_tab = 'matrix' THEN '四象限'
          ELSE '便签'
        END,
        x,
        y,
        width,
        height,
        always_on_top,
        0,
        datetime('now'),
        datetime('now')
      FROM widget_settings
      WHERE id = 'default'
        AND NOT EXISTS (SELECT 1 FROM widget_instances WHERE id = 'widget-default');
    `
  },
  {
    version: 28,
    sql: `
      ALTER TABLE widget_instances ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'expanded';
      ALTER TABLE widget_instances ADD COLUMN collapse_policy TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE widget_instances ADD COLUMN idle_timeout_sec INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE widget_instances ADD COLUMN edge_anchor TEXT NOT NULL DEFAULT 'right';
      ALTER TABLE widget_instances ADD COLUMN expanded_x INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_y INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_width INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_height INTEGER NULL;

      UPDATE widget_instances SET
        expanded_x = x,
        expanded_y = y,
        expanded_width = width,
        expanded_height = height;

      UPDATE widget_instances SET display_mode = 'edge_tab', collapse_policy = 'on_blur'
        WHERE kind IN ('matrix', 'view');
    `
  },
  {
    version: 29,
    sql: `
      DROP TABLE IF EXISTS desktop_custom_rules;
      DROP TABLE IF EXISTS desktop_category_rules;
      DROP TABLE IF EXISTS desktop_manual_assignments;
      DROP TABLE IF EXISTS desktop_categories;
      DROP TABLE IF EXISTS desktop_organize_snapshots;
      DROP TABLE IF EXISTS desktop_organize_settings;
      DROP TABLE IF EXISTS desktop_fence_layout;
      DROP TABLE IF EXISTS desktop_fence_settings;
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
    if (migration.version === 13) {
      migrateLegacyTaskTags(db)
    }
  }
}

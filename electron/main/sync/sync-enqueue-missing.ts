import type Database from 'better-sqlite3'
import type { SyncPreferences } from '@shared/sync-preferences'
import { isSyncEntityEnabled } from '@shared/sync-entity-filter'
import { CategoryRepository } from '../db/category-repository'
import { TaskRepository } from '../db/task-repository'
import { WidgetNoteRepository } from '../db/widget-note-repository'
import { TaskViewRepository } from '../db/task-view-repository'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { AppMessageRepository } from '../db/app-message-repository'
import { SyncOutbox } from '../db/sync-outbox'
import { readUiPreferencesSnapshot } from '../db/ui-preferences-snapshot'
import { enqueueAppSettingsUpsert, APP_SETTINGS_ENTITY_ID } from './app-settings-sync'
import { taskViewToSyncPayload } from './sync-apply'

/**
 * 将本地已有、但从未成功入队/推送的实体补进 outbox（按同步开关过滤）。
 *
 * @returns 本次新入队条数
 */
export function enqueueMissingLocalEntities(
  db: Database.Database,
  prefs: SyncPreferences,
  dataDir: string
): number {
  const outbox = new SyncOutbox(db)
  let enqueued = 0

  outbox.runInTransaction(() => {
    if (isSyncEntityEnabled('category', prefs)) {
      const cats = new CategoryRepository(db).list()
      for (const c of cats) {
        if (outbox.hasPendingOrPushed('category', c.id)) continue
        outbox.record({
          entityType: 'category',
          entityId: c.id,
          operation: 'upsert',
          payload: {
            id: c.id,
            name: c.name,
            color: c.color,
            sortOrder: c.sortOrder,
            keywords: c.keywords,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt
          },
          clientSyncVersion: 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('task', prefs)) {
      const tasks = new TaskRepository(db).list({})
      for (const t of tasks) {
        if (outbox.hasPendingOrPushed('task', t.id)) continue
        const { remindFiredAt: _omit, ...payload } = t
        outbox.record({
          entityType: 'task',
          entityId: t.id,
          operation: 'upsert',
          payload: { ...payload },
          clientSyncVersion: t.syncVersion || 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('widget_note', prefs)) {
      const notes = new WidgetNoteRepository(db).listNotes()
      for (const n of notes) {
        if (outbox.hasPendingOrPushed('widget_note', n.id)) continue
        outbox.record({
          entityType: 'widget_note',
          entityId: n.id,
          operation: 'upsert',
          payload: {
            id: n.id,
            content: n.content,
            color: n.color,
            pinned: n.pinned,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt
          },
          clientSyncVersion: 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('task_view', prefs)) {
      const views = new TaskViewRepository(db).list()
      for (const v of views) {
        if (outbox.hasPendingOrPushed('task_view', v.id)) continue
        outbox.record({
          entityType: 'task_view',
          entityId: v.id,
          operation: 'upsert',
          payload: taskViewToSyncPayload(v),
          clientSyncVersion: 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('scheduled_summary', prefs)) {
      const summaries = new ScheduledSummaryRepository(db).list()
      for (const s of summaries) {
        if (outbox.hasPendingOrPushed('scheduled_summary', s.id)) continue
        outbox.record({
          entityType: 'scheduled_summary',
          entityId: s.id,
          operation: 'upsert',
          payload: {
            id: s.id,
            name: s.name,
            categoryIds: s.categoryIds,
            scheduleType: s.scheduleType,
            sendTime: s.sendTime,
            sendWeekday: s.sendWeekday,
            sendDay: s.sendDay,
            useLlm: s.useLlm,
            promptText: s.promptText,
            reportConfig: s.reportConfig,
            enabled: s.enabled,
            lastSentAt: s.lastSentAt,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
          },
          clientSyncVersion: 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('app_message', prefs)) {
      // app_message 只同步“定时汇总的站内通知正文”，不同步任务提醒等其它消息来源。
      // 这样做是为了保持 Phase A 的语义边界：结果同步而非全量消息流同步。
      const messages = new AppMessageRepository(db).list(
        'notification',
        500,
        'scheduled_summary'
      )
      for (const m of messages) {
        if (outbox.hasPendingOrPushed('app_message', m.id)) continue
        outbox.record({
          entityType: 'app_message',
          entityId: m.id,
          operation: 'upsert',
          payload: {
            id: m.id,
            kind: m.kind,
            title: m.title,
            body: m.body,
            taskId: m.taskId,
            source: m.source,
            readAt: m.readAt,
            createdAt: m.createdAt,
            updatedAt: m.readAt ?? m.createdAt
          },
          clientSyncVersion: 1
        })
        enqueued += 1
      }
    }

    if (isSyncEntityEnabled('app_settings', prefs)) {
      if (!outbox.hasPendingOrPushed('app_settings', APP_SETTINGS_ENTITY_ID)) {
        const ui = readUiPreferencesSnapshot(dataDir)
        enqueueAppSettingsUpsert(
          outbox,
          new WidgetNoteRepository(db),
          Object.keys(ui).length ? ui : undefined
        )
        enqueued += 1
      }
    }
  })

  return enqueued
}

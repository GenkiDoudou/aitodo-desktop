import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { AppMessageRepository } from '../db/app-message-repository'
import { AppMessageService } from './app-message-service'
import { SyncOutbox } from '../db/sync-outbox'
import { DEFAULT_SYNC_PREFERENCES } from '@shared/sync-preferences'

describe('AppMessageService', () => {
  let service: AppMessageService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new AppMessageService(new AppMessageRepository(db))
  })

  it('creates and lists notification messages', () => {
    const msg = service.create({
      kind: 'notification',
      title: '任务提醒',
      body: '写周报',
      taskId: 't1'
    })
    const list = service.list('notification')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(msg.id)
    expect(service.countUnread('notification')).toBe(1)
  })

  it('markAllRead clears unread count for kind', () => {
    service.create({ kind: 'notification', title: 'a' })
    service.create({ kind: 'notification', title: 'b' })
    service.create({ kind: 'activity', title: 'c' })
    expect(service.countUnread('notification')).toBe(2)
    service.markAllRead('notification')
    expect(service.countUnread('notification')).toBe(0)
    expect(service.countUnread('activity')).toBe(1)
  })

  it('enqueues scheduled_summary messages when syncSummaryResults is on', () => {
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    const outbox = new SyncOutbox(db)
    const synced = new AppMessageService(
      new AppMessageRepository(db),
      outbox,
      () => ({ ...DEFAULT_SYNC_PREFERENCES, syncSummaryResults: true })
    )
    const msg = synced.create({
      kind: 'notification',
      title: '定时汇总：日报',
      body: '正文',
      source: 'scheduled_summary'
    })
    synced.create({
      kind: 'notification',
      title: '任务提醒',
      body: 'x',
      source: 'task_reminder'
    })
    const pending = outbox.listPending(20)
    expect(pending).toHaveLength(1)
    expect(pending[0].entityType).toBe('app_message')
    expect(pending[0].entityId).toBe(msg.id)

    const off = new AppMessageService(
      new AppMessageRepository(db),
      outbox,
      () => ({ ...DEFAULT_SYNC_PREFERENCES, syncSummaryResults: false })
    )
    off.create({
      kind: 'notification',
      title: '另一条汇总',
      body: 'y',
      source: 'scheduled_summary'
    })
    expect(outbox.listPending(20)).toHaveLength(1)
  })
})

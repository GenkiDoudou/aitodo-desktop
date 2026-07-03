import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { AppMessageRepository } from '../db/app-message-repository'
import { AppMessageService } from './app-message-service'

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

  it('markRead clears unread count', () => {
    const msg = service.create({ kind: 'notification', title: '测试' })
    service.markRead(msg.id)
    expect(service.countUnread('notification')).toBe(0)
  })
})

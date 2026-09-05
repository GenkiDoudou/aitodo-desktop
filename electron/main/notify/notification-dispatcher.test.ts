import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeNotificationConfig } from '../db/notification-config-store'
import { mergeNotificationConfig } from '@shared/notification-config'
import { readDeferredNotifies } from '../db/notification-deferred-store'
import {
  NotificationDispatcher,
  resetNotificationDispatcherForTests
} from './notification-dispatcher'
import { sendIyuu, sendWebhook } from './notify-channels'

describe('notify-channels', () => {
  it('builds IYUU form body', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), { status: 200 })
    ) as unknown as typeof fetch
    const result = await sendIyuu(
      'tok',
      {
        title: '标题',
        body: '内容',
        event: 'task_reminder',
        entityId: 't1',
        firedAt: '2026-07-28T12:00:00'
      },
      fetchImpl
    )
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalled()
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(String(init.body)).toContain('text=')
    expect(String(init.body)).toContain('desp=')
  })

  it('posts webhook JSON payload', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch
    const result = await sendWebhook(
      'https://example.com/hook',
      { 'X-Token': 'a' },
      {
        title: 'T',
        body: 'B',
        event: 'scheduled_summary',
        entityId: 's1',
        firedAt: '2026-07-28T12:00:00'
      },
      fetchImpl
    )
    expect(result.ok).toBe(true)
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const parsed = JSON.parse(String(init.body)) as Record<string, string>
    expect(parsed.event).toBe('scheduled_summary')
    expect(parsed.entityId).toBe('s1')
  })
})

describe('NotificationDispatcher', () => {
  let dataDir: string

  it('sends only active iyuu channel', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'aitodo-notify-'))
    writeNotificationConfig(
      dataDir,
      mergeNotificationConfig({
        systemTrayEnabled: false,
        activeChannel: 'iyuu',
        iyuu: { token: 'tok', events: ['task_reminder'] },
        webhook: { name: 'wh', url: 'https://hook.example', events: ['task_reminder'] }
      })
    )

    const tray = vi.fn()
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('iyuu')) {
        return new Response(JSON.stringify({ errcode: 0 }), { status: 200 })
      }
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch

    resetNotificationDispatcherForTests()
    const d = new NotificationDispatcher({
      getDataDir: () => dataDir,
      fetchImpl,
      showTray: tray,
      isLoggedIn: () => false
    })

    const records = await d.dispatch({
      event: 'task_reminder',
      title: '写周报',
      body: '写周报\n附上数据',
      entityId: 't1'
    })

    expect(tray).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)
    expect(records[0]?.channel).toBe('IYUU')
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes('hook.example'))).toBe(false)

    rmSync(dataDir, { recursive: true, force: true })
  })

  it('defers external send during quiet hours', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'aitodo-notify-qh-'))
    writeNotificationConfig(
      dataDir,
      mergeNotificationConfig({
        systemTrayEnabled: false,
        activeChannel: 'iyuu',
        iyuu: { token: 'tok', events: ['task_reminder'] },
        quietHours: { enabled: true, start: '23:00', end: '08:00' }
      })
    )

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ errcode: 0 }), { status: 200 }))

    resetNotificationDispatcherForTests()
    const d = new NotificationDispatcher({
      getDataDir: () => dataDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      isLoggedIn: () => false,
      now: () => new Date(2026, 6, 28, 23, 30)
    })

    const records = await d.dispatch({
      event: 'task_reminder',
      title: '写周报',
      body: '写周报',
      entityId: 't1',
      fireAt: '2026-07-28T23:30:00'
    })

    expect(records).toHaveLength(0)
    expect(fetchImpl).not.toHaveBeenCalled()
    const deferred = readDeferredNotifies(dataDir)
    expect(deferred).toHaveLength(1)
    expect(deferred[0]?.deferredTo).toContain('2026-07-29')

    rmSync(dataDir, { recursive: true, force: true })
  })

  it('logged in does not local-send channels (relay only)', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'aitodo-notify-login-'))
    writeNotificationConfig(
      dataDir,
      mergeNotificationConfig({
        systemTrayEnabled: false,
        activeChannel: 'iyuu',
        relayWhenOnline: true,
        iyuu: { token: 'tok', events: ['task_reminder'] }
      })
    )

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ errcode: 0 }), { status: 200 }))
    const relay = vi.fn(async () => true)

    resetNotificationDispatcherForTests()
    const d = new NotificationDispatcher({
      getDataDir: () => dataDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      isLoggedIn: () => true,
      relayIfLoggedIn: relay
    })

    const records = await d.dispatch({
      event: 'task_reminder',
      title: '写周报',
      body: '写周报',
      entityId: 't1'
    })

    expect(records).toHaveLength(0)
    expect(relay).toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()

    rmSync(dataDir, { recursive: true, force: true })
  })
})

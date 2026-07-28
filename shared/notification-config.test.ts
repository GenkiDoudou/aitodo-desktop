import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_CONFIG,
  activeChannelReady,
  buildTaskReminderExternalCopy,
  mergeNotificationConfig,
  type NotifyEvent
} from './notification-config'

describe('notification-config', () => {
  it('defaults tray on, iyuu active, relays on, quiet off', () => {
    const cfg = mergeNotificationConfig()
    expect(cfg.systemTrayEnabled).toBe(true)
    expect(cfg.activeChannel).toBe('iyuu')
    expect(cfg.relayWhenOnline).toBe(true)
    expect(cfg.relayWhenOffline).toBe(true)
    expect(cfg.quietHours.enabled).toBe(false)
    expect(cfg.iyuu.token).toBe('')
    expect(cfg.iyuu.events).toEqual(['task_reminder', 'scheduled_summary'])
    expect(cfg.webhook.url).toBe('')
    expect(cfg.lease.heartbeatIntervalMs).toBe(
      DEFAULT_NOTIFICATION_CONFIG.lease.heartbeatIntervalMs
    )
  })

  it('migrates legacy iyuu.enabled + webhooks[] to activeChannel + single webhook', () => {
    const cfg = mergeNotificationConfig({
      systemTrayEnabled: false,
      iyuu: { enabled: false, token: 'abc', events: ['task_reminder'] },
      webhooks: [
        {
          id: 'w1',
          name: 'hook',
          enabled: true,
          url: 'https://example.com',
          method: 'POST',
          events: ['scheduled_summary']
        },
        {
          id: 'w2',
          name: 'ignored',
          enabled: true,
          url: 'https://other.example',
          method: 'POST',
          events: ['task_reminder']
        }
      ]
    })
    expect(cfg.systemTrayEnabled).toBe(false)
    expect(cfg.activeChannel).toBe('webhook')
    expect(cfg.iyuu.token).toBe('abc')
    expect(cfg.iyuu.events).toEqual(['task_reminder'])
    expect(cfg.webhook.url).toBe('https://example.com')
    expect(cfg.webhook.name).toBe('hook')
    expect(cfg.webhook.events).toEqual(['scheduled_summary'])
  })

  it('activeChannelReady checks events and credentials', () => {
    const event: NotifyEvent = 'task_reminder'
    const iyuu = mergeNotificationConfig({
      activeChannel: 'iyuu',
      iyuu: { token: 't', events: ['task_reminder'] }
    })
    expect(activeChannelReady(iyuu, event).ok).toBe(true)
    expect(activeChannelReady(iyuu, 'scheduled_summary').ok).toBe(false)

    const wh = mergeNotificationConfig({
      activeChannel: 'webhook',
      webhook: { name: 'h', url: 'https://x', events: ['task_reminder'] }
    })
    expect(activeChannelReady(wh, event).ok).toBe(true)
    expect(
      activeChannelReady(
        mergeNotificationConfig({ activeChannel: 'webhook', webhook: { url: '', events: ['task_reminder'] } }),
        event
      ).ok
    ).toBe(false)
  })

  it('buildTaskReminderExternalCopy uses title and description', () => {
    expect(buildTaskReminderExternalCopy({ title: '写周报', description: '附上数据' })).toEqual({
      title: '写周报',
      body: '写周报\n附上数据'
    })
    expect(buildTaskReminderExternalCopy({ title: '写周报', description: null })).toEqual({
      title: '写周报',
      body: '写周报'
    })
  })
})

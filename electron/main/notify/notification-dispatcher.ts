import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import {
  activeChannelReady,
  type NotificationConfig,
  type NotifyDeliveryRecord,
  type NotifyDispatchPayload,
  type NotifyEvent
} from '@shared/notification-config'
import { inQuietHours, quietEnd } from '@shared/notify-quiet-hours'
import { showSystemNotification } from '../services/system-notification'
import {
  appendLocalDeliveryLog,
  readNotificationConfig
} from '../db/notification-config-store'
import { upsertDeferredNotify } from '../db/notification-deferred-store'
import { sendIyuu, sendWebhook, type FetchLike } from './notify-channels'

export interface NotifyDispatchInput {
  event: NotifyEvent
  title: string
  body: string
  entityId: string
  /** 业务计划触发时刻；缺省用 now（幂等键） */
  fireAt?: string
  /** 补写历史时不弹托盘 */
  skipTray?: boolean
  /** 跳过外发（仅托盘/站内已处理） */
  skipExternal?: boolean
}

export interface NotificationDispatcherDeps {
  getDataDir: () => string
  /** 是否视为已登录（有 token）；用于时机门禁 */
  isLoggedIn?: () => boolean
  /** 已登录时走服务端代发；返回 true 表示已由 relay 处理 */
  relayIfLoggedIn?: (payload: NotifyDispatchPayload) => Promise<boolean>
  fetchImpl?: FetchLike
  showTray?: (title: string, body: string) => void
  now?: () => Date
}

/**
 * 站内消息已写入后调用：按配置弹托盘并外发。
 */
export class NotificationDispatcher {
  constructor(private readonly deps: NotificationDispatcherDeps) {}

  getConfig(): NotificationConfig {
    return readNotificationConfig(this.deps.getDataDir())
  }

  async dispatch(input: NotifyDispatchInput): Promise<NotifyDeliveryRecord[]> {
    // dispatch 的职责边界：
    // - 先把“通知内容”构造成统一 payload（event/entityId/firedAt）。
    // - 决策系统托盘是否展示（cfg.systemTrayEnabled）。
    // - 若允许外发，则按：
    //   1) 登录状态 relay（可选）
    //   2) 免打扰（quiet hours）延后入 deferred queue
    //   3) activeChannelReady 选择 IYUU / Webhook
    //   4) 调用 sendIyuu / sendWebhook 并记录投递日志
    const cfg = this.getConfig()
    const fireAt = input.fireAt?.trim() || nowIso()
    const payload: NotifyDispatchPayload = {
      title: input.title.trim() || '小柒todo',
      body: (input.body || input.title).trim(),
      event: input.event,
      entityId: input.entityId,
      firedAt: fireAt
    }

    if (!input.skipTray && cfg.systemTrayEnabled) {
      const show = this.deps.showTray ?? showSystemNotification
      show(payload.title, payload.body.slice(0, 240))
    }

    if (input.skipExternal) return []

    const records: NotifyDeliveryRecord[] = []
    const loggedIn = this.deps.isLoggedIn?.() ?? false
    const now = this.deps.now?.() ?? new Date()

    // 登录态：到点外发由服务端负责。手动 runNow 仍可经 relayWhenOnline 走服务端代发；
    // 禁止本机直连 IYUU/Webhook，避免与服务端调度双发。
    if (loggedIn) {
      if (cfg.relayWhenOnline && this.deps.relayIfLoggedIn) {
        if (inQuietHours(now, cfg.quietHours)) {
          const end = quietEnd(now, cfg.quietHours)
          if (end) {
            upsertDeferredNotify(this.deps.getDataDir(), {
              id: uuidv4(),
              event: input.event,
              entityId: input.entityId,
              title: payload.title,
              body: payload.body,
              fireAt,
              deferredTo: end.toISOString()
            })
          }
          return records
        }
        try {
          const handled = await this.deps.relayIfLoggedIn(payload)
          if (handled) return records
        } catch (err) {
          console.error('[notify] relay failed (no local fallback when logged in)', err)
        }
      }
      return records
    }

    if (inQuietHours(now, cfg.quietHours)) {
      const end = quietEnd(now, cfg.quietHours)
      if (end) {
        // quiet hours 期间不直接投递：写 deferred 队列，等待到点再 flush。
        upsertDeferredNotify(this.deps.getDataDir(), {
          id: uuidv4(),
          event: input.event,
          entityId: input.entityId,
          title: payload.title,
          body: payload.body,
          fireAt,
          deferredTo: end.toISOString()
        })
      }
      return records
    }

    const ready = activeChannelReady(cfg, input.event)
    if (!ready.ok) return records

    if (ready.channel === 'iyuu') {
      const result = await sendIyuu(cfg.iyuu.token, payload, this.deps.fetchImpl)
      records.push(this.log('IYUU', input.event, result.ok, result.message))
    } else {
      const result = await sendWebhook(
        cfg.webhook.url,
        cfg.webhook.headers,
        payload,
        this.deps.fetchImpl
      )
      records.push(this.log(cfg.webhook.name || 'Webhook', input.event, result.ok, result.message))
    }

    return records
  }

  async testIyuu(token?: string): Promise<{ ok: boolean; message: string }> {
    const cfg = this.getConfig()
    const payload: NotifyDispatchPayload = {
      title: '小柒todo 测试',
      body: '这是一条 IYUU 测试通知',
      event: 'task_reminder',
      entityId: 'test',
      firedAt: nowIso()
    }
    return sendIyuu(token ?? cfg.iyuu.token, payload, this.deps.fetchImpl)
  }

  async testWebhook(
    url?: string,
    headers?: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    const cfg = this.getConfig()
    const payload: NotifyDispatchPayload = {
      title: '小柒todo 测试',
      body: '这是一条 Webhook 测试通知',
      event: 'task_reminder',
      entityId: 'test',
      firedAt: nowIso()
    }
    return sendWebhook(
      url ?? cfg.webhook.url,
      headers ?? cfg.webhook.headers,
      payload,
      this.deps.fetchImpl
    )
  }

  private log(
    channel: string,
    event: NotifyEvent,
    ok: boolean,
    message: string
  ): NotifyDeliveryRecord {
    const record: NotifyDeliveryRecord = {
      id: uuidv4(),
      at: nowIso(),
      event,
      channel,
      ok,
      message
    }
    try {
      appendLocalDeliveryLog(this.deps.getDataDir(), record)
    } catch (err) {
      console.error('[notify] append local log failed', err)
    }
    return record
  }
}

let dispatcherSingleton: NotificationDispatcher | null = null

export function getNotificationDispatcher(
  deps: NotificationDispatcherDeps
): NotificationDispatcher {
  if (!dispatcherSingleton) {
    dispatcherSingleton = new NotificationDispatcher(deps)
  }
  return dispatcherSingleton
}

export function resetNotificationDispatcherForTests(): void {
  dispatcherSingleton = null
}

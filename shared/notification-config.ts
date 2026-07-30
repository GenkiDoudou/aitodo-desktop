/** 通知管理：本机配置（登录拉取服务端渠道配置；显式保存时再上传） */

export const NOTIFY_EVENTS = ['task_reminder', 'scheduled_summary'] as const
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number]

export const ACTIVE_NOTIFY_CHANNELS = ['iyuu', 'webhook'] as const
export type ActiveNotifyChannel = (typeof ACTIVE_NOTIFY_CHANNELS)[number]

export interface NotifyLeaseConfig {
  heartbeatIntervalMs: number
  leaseTtlMs: number
}

export interface QuietHoursConfig {
  enabled: boolean
  /** HH:mm */
  start: string
  /** HH:mm */
  end: string
}

export interface IyuuChannelConfig {
  token: string
  events: NotifyEvent[]
}

/** 单条 Webhook（与 IYUU 互斥生效） */
export interface WebhookChannelConfig {
  name: string
  url: string
  headers?: Record<string, string>
  events: NotifyEvent[]
}

export interface NotificationConfig {
  systemTrayEnabled: boolean
  activeChannel: ActiveNotifyChannel
  relayWhenOnline: boolean
  relayWhenOffline: boolean
  quietHours: QuietHoursConfig
  iyuu: IyuuChannelConfig
  webhook: WebhookChannelConfig
  lease: NotifyLeaseConfig
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  systemTrayEnabled: true,
  activeChannel: 'iyuu',
  relayWhenOnline: true,
  relayWhenOffline: true,
  quietHours: {
    enabled: false,
    start: '23:00',
    end: '08:00'
  },
  iyuu: {
    token: '',
    events: [...NOTIFY_EVENTS]
  },
  webhook: {
    name: 'Webhook',
    url: '',
    events: [...NOTIFY_EVENTS]
  },
  lease: {
    heartbeatIntervalMs: 30_000,
    leaseTtlMs: 90_000
  }
}

export function isNotifyEvent(value: unknown): value is NotifyEvent {
  return typeof value === 'string' && (NOTIFY_EVENTS as readonly string[]).includes(value)
}

function normalizeEvents(raw: unknown): NotifyEvent[] {
  if (!Array.isArray(raw)) return [...NOTIFY_EVENTS]
  const events = raw.filter(isNotifyEvent)
  return events.length ? events : [...NOTIFY_EVENTS]
}

function normalizeHm(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return fallback
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return fallback
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function normalizeHeaders(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const headers = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[0] === 'string' && typeof e[1] === 'string'
    )
  )
  return Object.keys(headers).length ? headers : undefined
}

function normalizeWebhookSingle(raw: unknown): WebhookChannelConfig {
  const base = DEFAULT_NOTIFICATION_CONFIG.webhook
  if (!raw || typeof raw !== 'object') return { ...base, events: [...base.events] }
  const w = raw as Record<string, unknown>
  const headers = normalizeHeaders(w.headers)
  return {
    name: typeof w.name === 'string' && w.name.trim() ? w.name.trim() : base.name,
    url: typeof w.url === 'string' ? w.url.trim() : '',
    ...(headers ? { headers } : {}),
    events: normalizeEvents(w.events)
  }
}

/** 从旧版 webhooks[] / iyuu.enabled 推断 activeChannel 与单条 webhook */
function migrateFromLegacy(raw: Record<string, unknown>): {
  activeChannel: ActiveNotifyChannel
  webhook: WebhookChannelConfig
} {
  const iyuu = raw.iyuu && typeof raw.iyuu === 'object' ? (raw.iyuu as Record<string, unknown>) : null
  const iyuuEnabled = Boolean(iyuu?.enabled)
  let webhook = normalizeWebhookSingle(raw.webhook)
  let anyWebhookEnabled = Boolean(webhook.url)

  if (Array.isArray(raw.webhooks) && raw.webhooks.length) {
    const first = raw.webhooks[0]
    if (first && typeof first === 'object') {
      const w = first as Record<string, unknown>
      webhook = normalizeWebhookSingle({
        name: w.name,
        url: w.url,
        headers: w.headers,
        events: w.events
      })
      anyWebhookEnabled = Boolean(w.enabled) && Boolean(webhook.url)
    }
  }

  let activeChannel: ActiveNotifyChannel = 'iyuu'
  if (typeof raw.activeChannel === 'string' && ACTIVE_NOTIFY_CHANNELS.includes(raw.activeChannel as ActiveNotifyChannel)) {
    activeChannel = raw.activeChannel as ActiveNotifyChannel
  } else if (anyWebhookEnabled && !iyuuEnabled) {
    activeChannel = 'webhook'
  } else {
    activeChannel = 'iyuu'
  }

  return { activeChannel, webhook }
}

export function mergeNotificationConfig(partial?: unknown): NotificationConfig {
  const base = structuredClone(DEFAULT_NOTIFICATION_CONFIG)
  if (!partial || typeof partial !== 'object') return base
  const raw = partial as Record<string, unknown>
  const migrated = migrateFromLegacy(raw)

  const iyuuPartial =
    raw.iyuu && typeof raw.iyuu === 'object' ? (raw.iyuu as Record<string, unknown>) : null
  const leasePartial =
    raw.lease && typeof raw.lease === 'object' ? (raw.lease as Record<string, unknown>) : null
  const quietPartial =
    raw.quietHours && typeof raw.quietHours === 'object'
      ? (raw.quietHours as Record<string, unknown>)
      : null

  const activeChannel =
    typeof raw.activeChannel === 'string' &&
    ACTIVE_NOTIFY_CHANNELS.includes(raw.activeChannel as ActiveNotifyChannel)
      ? (raw.activeChannel as ActiveNotifyChannel)
      : migrated.activeChannel

  return {
    systemTrayEnabled:
      typeof raw.systemTrayEnabled === 'boolean' ? raw.systemTrayEnabled : base.systemTrayEnabled,
    activeChannel,
    relayWhenOnline:
      typeof raw.relayWhenOnline === 'boolean' ? raw.relayWhenOnline : base.relayWhenOnline,
    relayWhenOffline:
      typeof raw.relayWhenOffline === 'boolean' ? raw.relayWhenOffline : base.relayWhenOffline,
    quietHours: {
      enabled:
        typeof quietPartial?.enabled === 'boolean'
          ? quietPartial.enabled
          : base.quietHours.enabled,
      start: normalizeHm(quietPartial?.start, base.quietHours.start),
      end: normalizeHm(quietPartial?.end, base.quietHours.end)
    },
    iyuu: {
      token: typeof iyuuPartial?.token === 'string' ? iyuuPartial.token : base.iyuu.token,
      events:
        iyuuPartial?.events !== undefined ? normalizeEvents(iyuuPartial.events) : base.iyuu.events
    },
    webhook: migrated.webhook,
    lease: {
      heartbeatIntervalMs:
        typeof leasePartial?.heartbeatIntervalMs === 'number' &&
        leasePartial.heartbeatIntervalMs > 0
          ? leasePartial.heartbeatIntervalMs
          : base.lease.heartbeatIntervalMs,
      leaseTtlMs:
        typeof leasePartial?.leaseTtlMs === 'number' && leasePartial.leaseTtlMs > 0
          ? leasePartial.leaseTtlMs
          : base.lease.leaseTtlMs
    }
  }
}

/**
 * 登录拉取：用服务端渠道字段覆盖本地；托盘 / 租约为本机字段，保留不变。
 */
export function applyServerChannelConfig(
  local: NotificationConfig,
  server: unknown
): NotificationConfig {
  const remote = mergeNotificationConfig(server)
  return mergeNotificationConfig({
    ...local,
    activeChannel: remote.activeChannel,
    relayWhenOnline: remote.relayWhenOnline,
    relayWhenOffline: remote.relayWhenOffline,
    quietHours: remote.quietHours,
    iyuu: remote.iyuu,
    webhook: remote.webhook
  })
}

/** 生效渠道是否订阅该事件且具备最低凭证 */
export function activeChannelReady(
  cfg: NotificationConfig,
  event: NotifyEvent
): { channel: ActiveNotifyChannel; ok: boolean } {
  if (cfg.activeChannel === 'iyuu') {
    return {
      channel: 'iyuu',
      ok: cfg.iyuu.events.includes(event) && Boolean(cfg.iyuu.token.trim())
    }
  }
  return {
    channel: 'webhook',
    ok: cfg.webhook.events.includes(event) && Boolean(cfg.webhook.url.trim())
  }
}

/** @deprecated 兼容旧测试；优先用 activeChannelReady */
export function channelSubscribesTo(
  channel: { enabled?: boolean; events: NotifyEvent[] },
  event: NotifyEvent
): boolean {
  const enabled = channel.enabled !== false
  return enabled && channel.events.includes(event)
}

/** 任务提醒外部渠道文案 */
export function buildTaskReminderExternalCopy(task: {
  title: string
  description?: string | null
}): { title: string; body: string } {
  const title = task.title.trim() || '任务提醒'
  const desc = task.description?.trim()
  return { title, body: desc ? `${title}\n${desc}` : title }
}

export interface NotifyDispatchPayload {
  title: string
  body: string
  event: NotifyEvent
  entityId: string
  firedAt: string
}

export interface NotifyDeliveryRecord {
  id: string
  at: string
  event: NotifyEvent
  channel: string
  ok: boolean
  message?: string
}

export type PendingNotifyKind = 'upcoming' | 'deferred' | 'queued'

export interface PendingNotifyItem {
  id: string
  kind: PendingNotifyKind
  event: NotifyEvent
  entityId: string
  title: string
  bodyPreview?: string
  fireAt: string
  deferredTo?: string | null
  source: 'local' | 'server'
}

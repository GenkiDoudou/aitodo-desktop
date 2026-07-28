import type {
  NotificationConfig,
  NotifyDeliveryRecord,
  NotifyDispatchPayload,
  PendingNotifyItem
} from '@shared/notification-config'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class NotifyApiError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message)
    this.name = 'NotifyApiError'
  }
}

/** 通知代发 / 租约 / 投递 HTTP 客户端（Main） */
export class NotifyApiClient {
  constructor(
    private baseUrl: string,
    private accessToken: string | null = null
  ) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '')
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  async putConfig(config: NotificationConfig): Promise<void> {
    await this.request('PUT', '/api/notify/config', {
      activeChannel: config.activeChannel,
      relayWhenOnline: config.relayWhenOnline,
      relayWhenOffline: config.relayWhenOffline,
      quietHours: config.quietHours,
      iyuu: {
        token: config.iyuu.token,
        events: config.iyuu.events
      },
      webhook: {
        name: config.webhook.name,
        url: config.webhook.url,
        headers: config.webhook.headers,
        events: config.webhook.events
      }
    })
  }

  async getConfig(): Promise<NotificationConfig> {
    return this.request('GET', '/api/notify/config')
  }

  async dispatch(payload: NotifyDispatchPayload, idempotencyKey: string): Promise<void> {
    await this.request('POST', '/api/notify/dispatch', {
      idempotencyKey,
      event: payload.event,
      entityId: payload.entityId,
      title: payload.title,
      body: payload.body,
      firedAt: payload.firedAt,
      origin: 'relay'
    })
  }

  async heartbeat(deviceId: string, leaseTtlMs: number): Promise<void> {
    await this.request('POST', '/api/notify/lease/heartbeat', { deviceId, leaseTtlMs })
  }

  async releaseLease(deviceId: string): Promise<void> {
    await this.request('POST', '/api/notify/lease/release', { deviceId })
  }

  async listDeliveries(limit = 50): Promise<NotifyDeliveryRecord[]> {
    const rows = await this.request<
      Array<{
        id: string
        event: string
        channel: string
        ok: boolean
        message?: string
        createdAt?: string
      }>
    >('GET', `/api/notify/deliveries?limit=${limit}`)
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt ?? '',
      event: r.event as NotifyDeliveryRecord['event'],
      channel: r.channel,
      ok: r.ok,
      message: r.message
    }))
  }

  async listUnacked(): Promise<
    Array<{
      id: string
      event: string
      entityId: string
      title: string
      body: string
    }>
  > {
    return this.request('GET', '/api/notify/deliveries/unacked?limit=50')
  }

  async listPending(limit = 50): Promise<PendingNotifyItem[]> {
    const rows = await this.request<
      Array<{
        id: string
        kind: string
        event: string
        entityId: string
        title: string
        bodyPreview?: string
        fireAt: string
        deferredTo?: string | null
        source: string
      }>
    >('GET', `/api/notify/pending?limit=${limit}`)
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as PendingNotifyItem['kind'],
      event: r.event as PendingNotifyItem['event'],
      entityId: r.entityId,
      title: r.title,
      bodyPreview: r.bodyPreview,
      fireAt: r.fireAt,
      deferredTo: r.deferredTo ?? null,
      source: (r.source === 'local' ? 'local' : 'server') as PendingNotifyItem['source']
    }))
  }

  async ack(ids: string[]): Promise<void> {
    await this.request('POST', '/api/notify/deliveries/ack', { ids })
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.accessToken) {
      throw new NotifyApiError('未登录', 401)
    }
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.accessToken}`
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000)
      })
    } catch (err) {
      throw new NotifyApiError(
        err instanceof Error ? `网络错误：${err.message}` : '网络错误',
        500
      )
    }
    let envelope: ApiEnvelope<T>
    try {
      envelope = (await res.json()) as ApiEnvelope<T>
    } catch {
      throw new NotifyApiError(`无效响应 HTTP ${res.status}`, res.status)
    }
    if (envelope.code !== 0) {
      throw new NotifyApiError(envelope.message || `业务错误 ${envelope.code}`, envelope.code)
    }
    return envelope.data
  }
}

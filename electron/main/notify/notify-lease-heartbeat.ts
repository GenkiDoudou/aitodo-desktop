import type { NotificationConfig } from '@shared/notification-config'
import type { NotifyApiClient } from './notify-api-client'

/** 登录态心跳：维持服务端触发租约 */
export class NotifyLeaseHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly getClient: () => NotifyApiClient | null,
    private readonly getDeviceId: () => string,
    private readonly getLeaseTtlMs: () => number,
    private readonly getIntervalMs: () => number
  ) {}

  start(): void {
    this.stop()
    void this.beat()
    this.timer = setInterval(() => {
      void this.beat()
    }, this.getIntervalMs())
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async release(): Promise<void> {
    this.stop()
    const client = this.getClient()
    if (!client) return
    try {
      await client.releaseLease(this.getDeviceId())
    } catch {
      /* ignore */
    }
  }

  private async beat(): Promise<void> {
    const client = this.getClient()
    if (!client) return
    try {
      await client.heartbeat(this.getDeviceId(), this.getLeaseTtlMs())
    } catch (err) {
      console.warn('[notify-lease] heartbeat failed', err)
    }
  }
}

export function channelConfigFromLocal(config: NotificationConfig): NotificationConfig {
  return config
}

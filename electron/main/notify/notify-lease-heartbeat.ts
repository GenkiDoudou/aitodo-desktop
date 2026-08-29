import type { NotificationConfig } from '@shared/notification-config'
import type { NotifyApiClient } from './notify-api-client'

/**
 * 登录态设备租约心跳。
 *
 * 作用：告诉 Sync/Notify 服务端「本机仍在线」。
 * - 租约有效期间：到点外发优先由在线端 / relayWhenOnline 路径处理；
 * - 租约过期（关端且心跳停）：若开启 relayWhenOffline，服务端可自行到点外发。
 *
 * TTL / 心跳间隔来自本机 notification config，便于用户调优。
 */
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
    // 启动立即打一次，避免等首个 interval 才建立租约。
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

  /**
   * 退出登录 / 关断 notify runtime 时主动释放租约，
   * 让服务端更快进入「可离线代发」状态（失败忽略，避免挡 logout）。
   */
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
      // 心跳失败不停止 timer：网络抖动后下一拍可恢复。
      console.warn('[notify-lease] heartbeat failed', err)
    }
  }
}

/** 占位：当前配置即本机权威源，无需再映射字段。 */
export function channelConfigFromLocal(config: NotificationConfig): NotificationConfig {
  return config
}

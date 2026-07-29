/**
 * 每日免打扰时段判定（可跨午夜）。
 *
 * 时区：使用传入 Date 的本地时分（桌面端一般为 Asia/Shanghai 系统时区）。
 * 被 NotificationDispatcher 用于：命中窗口则写入 deferred 队列，不立刻外发；
 * 站内消息 / 托盘仍可由上层决定是否展示。
 */

export function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * 当前是否处于免打扰窗口内。
 * start===end 视为全天静默。
 */
export function inQuietHours(
  now: Date,
  quiet: { enabled: boolean; start: string; end: string }
): boolean {
  if (!quiet.enabled) return false
  const s = parseHm(quiet.start)
  const e = parseHm(quiet.end)
  if (!s || !e) return false
  const startM = s.hour * 60 + s.minute
  const endM = e.hour * 60 + e.minute
  const nowM = minutesOfDay(now)
  if (startM === endM) return true
  if (startM < endM) {
    return nowM >= startM && nowM < endM
  }
  // 跨午夜：例如 23:00–08:00
  return nowM >= startM || nowM < endM
}

/**
 * 免打扰结束时刻（若当前不在窗口内，返回 null）。
 * Dispatcher 用该时刻作为 deferredTo，到点由 flushDeferred 补发外发。
 */
export function quietEnd(now: Date, quiet: { enabled: boolean; start: string; end: string }): Date | null {
  if (!inQuietHours(now, quiet)) return null
  const e = parseHm(quiet.end)
  if (!e) return null
  const end = new Date(now)
  end.setSeconds(0, 0)
  end.setHours(e.hour, e.minute, 0, 0)
  const s = parseHm(quiet.start)
  if (!s) return end
  const startM = s.hour * 60 + s.minute
  const endM = e.hour * 60 + e.minute
  const nowM = minutesOfDay(now)
  // 跨午夜且当前在 start 之后（晚间段）：结束日为次日
  if (startM > endM && nowM >= startM) {
    end.setDate(end.getDate() + 1)
  }
  return end
}

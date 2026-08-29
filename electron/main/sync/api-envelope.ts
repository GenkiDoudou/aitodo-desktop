/**
 * 桌面 Sync/Notify API 统一信封解析。
 * quickboot 管理端用 {@code msg}，桌面 sync 模块用 {@code message}，需兼容两者。
 */
export interface ApiEnvelope<T> {
  code: number
  /** 桌面 sync 模块（todo-service 兼容） */
  message?: string
  /** quickboot {@code R} 信封 */
  msg?: string
  data: T
}

/**
 * 从响应信封提取可读错误文案；避免只显示「业务错误 600」。
 *
 * @param envelope HTTP JSON 体
 * @returns 非空时用于 Toast / SyncApiError
 */
export function readApiEnvelopeError(envelope: ApiEnvelope<unknown>): string {
  const text = (envelope.message ?? envelope.msg)?.trim()
  if (text) {
    return text
  }
  return `业务错误 ${envelope.code}`
}

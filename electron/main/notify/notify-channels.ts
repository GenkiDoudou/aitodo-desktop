import type { NotifyDispatchPayload } from '@shared/notification-config'

export interface ChannelSendResult {
  ok: boolean
  message: string
}

/** 可注入 fetch，便于单测 mock，不依赖真实外网。 */
export type FetchLike = typeof fetch

/**
 * IYUU 直连外发（本机或服务端代发最终都会落到类似路径）。
 *
 * 约定：
 * - token 为空直接失败，不发请求；
 * - 使用 form-urlencoded：`text`=标题、`desp`=正文；
 * - 业务错误看 HTTP 状态或 JSON `errcode !== 0`；
 * - 网络/超时一律映射为 `{ ok:false, message }`，由 Dispatcher 写本地投递日志。
 */
export async function sendIyuu(
  token: string,
  payload: NotifyDispatchPayload,
  fetchImpl: FetchLike = fetch
): Promise<ChannelSendResult> {
  const trimmed = token.trim()
  if (!trimmed) {
    return { ok: false, message: 'IYUU 令牌为空' }
  }
  const url = `https://iyuu.cn/${encodeURIComponent(trimmed)}.send`
  const body = new URLSearchParams({
    text: payload.title,
    desp: payload.body
  })
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body,
      signal: AbortSignal.timeout(15_000)
    })
    const text = await res.text()
    let errcode: number | undefined
    let errmsg = text
    try {
      const json = JSON.parse(text) as { errcode?: number; errmsg?: string }
      errcode = json.errcode
      if (json.errmsg) errmsg = json.errmsg
    } catch {
      /* IYUU 偶发非 JSON 文本；仍用原始 text 作为失败信息 */
    }
    if (!res.ok || (errcode !== undefined && errcode !== 0)) {
      return { ok: false, message: errmsg || `HTTP ${res.status}` }
    }
    return { ok: true, message: 'ok' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'IYUU 发送失败'
    }
  }
}

/**
 * Webhook 直连外发：固定 POST JSON。
 *
 * Body 字段与设置页说明一致：title / body / event / entityId / firedAt。
 * 自定义 headers 由用户配置透传（勿在此写入 Authorization 之外的密钥硬编码）。
 */
export async function sendWebhook(
  url: string,
  headers: Record<string, string> | undefined,
  payload: NotifyDispatchPayload,
  fetchImpl: FetchLike = fetch
): Promise<ChannelSendResult> {
  const target = url.trim()
  if (!target) {
    return { ok: false, message: 'Webhook URL 为空' }
  }
  try {
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(headers ?? {})
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        event: payload.event,
        entityId: payload.entityId,
        firedAt: payload.firedAt
      }),
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, message: text || `HTTP ${res.status}` }
    }
    return { ok: true, message: 'ok' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Webhook 发送失败'
    }
  }
}

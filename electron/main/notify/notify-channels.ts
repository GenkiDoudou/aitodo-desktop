import type { NotifyDispatchPayload } from '@shared/notification-config'

export interface ChannelSendResult {
  ok: boolean
  message: string
}

export type FetchLike = typeof fetch

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
      /* non-json */
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

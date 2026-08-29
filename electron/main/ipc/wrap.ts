import type { IpcResult } from '@shared/types'
import { AppError } from '@shared/types'
import { NotifyApiError } from '../notify/notify-api-client'
import { SyncApiError } from '../sync/sync-api-client'

function toIpcError(err: unknown): IpcResult<never> {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message } }
  }
  if (err instanceof SyncApiError) {
    return { ok: false, error: { code: 'SYNC_API_ERROR', message: err.message } }
  }
  if (err instanceof NotifyApiError) {
    return { ok: false, error: { code: 'NOTIFY_API_ERROR', message: err.message } }
  }
  if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'DB_NOT_WRITABLE') {
    return {
      ok: false,
      error: {
        code: 'DB_NOT_WRITABLE',
        message: err.message
      }
    }
  }
  const message = err instanceof Error ? err.message : '未知错误'
  return { ok: false, error: { code: 'INTERNAL_ERROR', message } }
}

/** 将 Main 层异常统一包装为 IPC 信封（同步） */
export function wrapIpc<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (err) {
    return toIpcError(err)
  }
}

/** 异步 IPC：必须 await，否则 Promise 会被直接序列化导致渲染端拿到空对象 */
export async function wrapIpcAsync<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return toIpcError(err)
  }
}

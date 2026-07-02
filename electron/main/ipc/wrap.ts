import type { IpcResult } from '@shared/types'
import { AppError } from '@shared/types'

/** 将 Main 层异常统一包装为 IPC 信封 */
export function wrapIpc<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message } }
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
}

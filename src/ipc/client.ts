import type { IpcResult } from '@shared/types'
import { ElMessage } from 'element-plus'

/** unwrapIpc 失败时已 Toast，调用方 catch 中勿重复提示 */
export class IpcUnwrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IpcUnwrapError'
  }
}

/** 解包 IPC 结果；失败时 Toast 并抛出，供 store 中断流程 */
export function unwrapIpc<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    ElMessage.error(result.error.message)
    throw new IpcUnwrapError(result.error.message)
  }
  return result.data
}

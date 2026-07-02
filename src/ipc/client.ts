import type { IpcResult } from '@shared/types'
import { ElMessage } from 'element-plus'

/** 解包 IPC 结果；失败时 Toast 并抛出，供 store 中断流程 */
export function unwrapIpc<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    ElMessage.error(result.error.message)
    throw new Error(result.error.code)
  }
  return result.data
}

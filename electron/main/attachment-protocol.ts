import { protocol } from 'electron'
import { resolveAttachmentPathFromRequest } from './services/attachment-service'

/** 须在 app.whenReady 之前调用，允许渲染进程加载 aitodo-attachment:// 图片 */
export function registerAttachmentSchemePrivilege(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'aitodo-attachment',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ])
}

/** 将 aitodo-attachment:// URI 映射到本地 attachments 文件（供 img / 预览加载） */
export function registerAttachmentProtocol(): void {
  protocol.registerFileProtocol('aitodo-attachment', (request, callback) => {
    const filePath = resolveAttachmentPathFromRequest(request.url)
    if (!filePath) {
      callback({ error: -6 })
      return
    }
    callback({ path: filePath })
  })
}

/** 任务正文内嵌附件 URI 协议（存于 description Markdown 中） */
export const ATTACHMENT_SCHEME = 'aitodo-attachment://'

export interface SavedAttachment {
  /** 写入 Markdown 的完整 URI */
  uri: string
  /** 原始文件名 */
  name: string
  /** 是否图片（用于选择 ![](/[]) 语法） */
  isImage: boolean
  storage?: 'local' | 'server' | 's3'
  remoteId?: string
  objectKey?: string
  sha256?: string
  size?: number
  /** 远端上传失败时提示；本地文件仍可用 */
  uploadError?: string
}

/** 从 Markdown 文本中提取附件 URI */
export function extractAttachmentUris(markdown: string): string[] {
  const re = /aitodo-attachment:\/\/[^\s)]+/g
  return [...new Set(markdown.match(re) ?? [])]
}

export function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

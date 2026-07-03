import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { dialog, shell, type BrowserWindow } from 'electron'
import { getActiveDataDir } from '../db/database'
import { ATTACHMENT_SCHEME, isImageFileName, type SavedAttachment } from '@shared/attachment'

function attachmentsDir(): string {
  const dir = path.join(getActiveDataDir(), 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'file'
}

/** 将缓冲区写入 attachments 目录并返回 Markdown URI */
export function saveAttachmentBuffer(name: string, buffer: Buffer): SavedAttachment {
  const safeName = sanitizeFileName(name)
  const stored = `${uuidv4()}-${safeName}`
  const rel = `attachments/${stored}`
  const dir = attachmentsDir()
  fs.writeFileSync(path.join(dir, stored), buffer)
  return {
    uri: `${ATTACHMENT_SCHEME}${rel}`,
    name: safeName,
    isImage: isImageFileName(safeName)
  }
}

/**
 * 将 aitodo-attachment URI 规范为 attachments/相对路径。
 * Electron 请求 URL 时可能把 attachments 解析为 hostname（path 为 /uuid-name.png），需兼容。
 */
function attachmentRelFromUri(uri: string): string | null {
  const normalized = decodeURIComponent(uri.trim())
  if (!normalized.startsWith(ATTACHMENT_SCHEME)) {
    return null
  }
  let rel = normalized.slice(ATTACHMENT_SCHEME.length)
  if (rel.startsWith('/')) {
    rel = rel.slice(1)
  }
  if (rel.startsWith('attachments/') && !rel.includes('..')) {
    return rel
  }
  try {
    const u = new URL(normalized)
    if (u.protocol === 'aitodo-attachment:' && u.hostname === 'attachments') {
      const fromHost = `attachments${u.pathname}`
      if (!fromHost.includes('..')) {
        return fromHost
      }
    }
  } catch {
    /* 非标准 URL，沿用下方校验失败 */
  }
  return null
}

/** 解析附件 URI 为本地绝对路径；非法或不存在时返回 null */
export function resolveAttachmentPath(uri: string): string | null {
  const rel = attachmentRelFromUri(uri)
  if (!rel) {
    return null
  }
  const full = path.join(getActiveDataDir(), rel)
  if (!fs.existsSync(full)) {
    return null
  }
  return full
}

/** 协议 handler 收到的 request.url 可能含查询串，需截取后再解析 */
export function resolveAttachmentPathFromRequest(requestUrl: string): string | null {
  const withoutQuery = requestUrl.split(/[?#]/)[0] ?? requestUrl
  return resolveAttachmentPath(withoutQuery)
}

/** 供渲染进程预览/打开：转为 file:// URL */
export function resolveAttachmentFileUrl(uri: string): string | null {
  const full = resolveAttachmentPath(uri)
  if (!full) return null
  return `file:///${full.replace(/\\/g, '/')}`
}

/** 系统文件选择器 → 复制到 attachments 目录 */
export async function pickAndSaveAttachment(parent?: BrowserWindow): Promise<SavedAttachment | null> {
  if (parent && !parent.isDestroyed()) {
    parent.focus()
  }
  const result = await dialog.showOpenDialog(parent ?? undefined, {
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) {
    return null
  }
  const src = result.filePaths[0]
  const name = path.basename(src)
  const buffer = fs.readFileSync(src)
  return saveAttachmentBuffer(name, buffer)
}

/** 用系统默认程序打开本地附件文件 */
export function openAttachmentPath(uri: string): void {
  const full = resolveAttachmentPath(uri)
  if (!full) {
    throw new Error('附件不存在')
  }
  void shell.openPath(full)
}

/** 另存为：将附件复制到用户选择的路径 */
export async function downloadAttachment(
  parent: BrowserWindow | undefined,
  uri: string,
  suggestedName?: string
): Promise<boolean> {
  const full = resolveAttachmentPath(uri)
  if (!full) {
    throw new Error('附件不存在')
  }
  if (parent && !parent.isDestroyed()) {
    parent.focus()
  }
  const base = suggestedName?.trim() || path.basename(full)
  const result = await dialog.showSaveDialog(parent ?? undefined, {
    defaultPath: base
  })
  if (result.canceled || !result.filePath) {
    return false
  }
  fs.copyFileSync(full, result.filePath)
  return true
}

/** 打开附件：支持 Markdown URI 或预览渲染后的 file:// */
export function openAttachmentUriOrFileUrl(uriOrFile: string): void {
  if (uriOrFile.startsWith('file://')) {
    void shell.openPath(fileURLToPath(uriOrFile))
    return
  }
  openAttachmentPath(uriOrFile)
}

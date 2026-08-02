import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { dialog, shell, type BrowserWindow } from 'electron'
import { getActiveDataDir } from '../db/database'
import { ATTACHMENT_SCHEME, isImageFileName, type SavedAttachment } from '@shared/attachment'
import { readAttachmentPrefs } from '../data-path'
import { readS3Secrets } from '../s3-credentials'
import {
  applyRemoteUploadAfterLocalSave,
  ensureLocalAttachmentFile,
  type AttachmentOpenMeta,
  type AttachmentRemoteHooks
} from './attachment-remote'
import { isOverServerAttachmentLimit, ATTACHMENT_SERVER_MAX_BYTES } from '@shared/attachment-storage'

export type AttachmentAuthResolver = () => { baseUrl: string; accessToken: string } | null

let authResolver: AttachmentAuthResolver = () => null

/** 由主进程注入：登录态解析服务端 baseUrl + token */
export function setAttachmentAuthResolver(resolver: AttachmentAuthResolver): void {
  authResolver = resolver
}

function defaultRemoteHooks(): AttachmentRemoteHooks {
  return {
    getPrefs: () => readAttachmentPrefs(),
    getAuth: () => authResolver(),
    getS3Secrets: () => readS3Secrets()
  }
}

function attachmentsDir(): string {
  const dir = path.join(getActiveDataDir(), 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'file'
}

/** 将缓冲区写入 attachments 目录并返回 Markdown URI（仅本机，不含远端） */
export function saveAttachmentBuffer(name: string, buffer: Buffer): SavedAttachment {
  const safeName = sanitizeFileName(name)
  const stored = `${uuidv4()}-${safeName}`
  const rel = `attachments/${stored}`
  const dir = attachmentsDir()
  fs.writeFileSync(path.join(dir, stored), buffer)
  return {
    uri: `${ATTACHMENT_SCHEME}${rel}`,
    name: safeName,
    isImage: isImageFileName(safeName),
    size: buffer.length,
    storage: 'local'
  }
}

/** 本机写入后按附件偏好尝试 server/s3 上传 */
export async function saveAttachmentBufferWithRemote(
  name: string,
  buffer: Buffer,
  hooks: AttachmentRemoteHooks = defaultRemoteHooks()
): Promise<SavedAttachment> {
  const prefs = hooks.getPrefs()
  if (prefs.mode === 'server' && isOverServerAttachmentLimit(buffer.length)) {
    throw new Error(
      `服务端附件不能超过 ${Math.floor(ATTACHMENT_SERVER_MAX_BYTES / (1024 * 1024))}MB`
    )
  }
  const local = saveAttachmentBuffer(name, buffer)
  return applyRemoteUploadAfterLocalSave(local, buffer, hooks)
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

/** 解析附件 URI 为本地绝对路径（即使文件尚不存在）；非法 URI 返回 null */
export function attachmentAbsolutePath(uri: string): string | null {
  const rel = attachmentRelFromUri(uri)
  if (!rel) return null
  return path.join(getActiveDataDir(), rel)
}

/** 解析附件 URI 为本地绝对路径；非法或不存在时返回 null */
export function resolveAttachmentPath(uri: string): string | null {
  const full = attachmentAbsolutePath(uri)
  if (!full || !fs.existsSync(full)) {
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

/** 系统文件选择器 → 复制到 attachments 目录（含远端上传） */
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
  return saveAttachmentBufferWithRemote(name, buffer)
}

async function ensurePathForOpen(
  uri: string,
  meta?: AttachmentOpenMeta,
  hooks: AttachmentRemoteHooks = defaultRemoteHooks()
): Promise<string> {
  const full = attachmentAbsolutePath(uri)
  if (!full) {
    throw new Error('附件不存在')
  }
  fs.mkdirSync(path.dirname(full), { recursive: true })
  return ensureLocalAttachmentFile(
    full,
    uri,
    meta,
    (p, buf) => fs.writeFileSync(p, buf),
    (p) => fs.existsSync(p),
    hooks
  )
}

/** 用系统默认程序打开本地附件文件（可按需从远端拉回） */
export async function openAttachmentPath(uri: string, meta?: AttachmentOpenMeta): Promise<void> {
  const full = await ensurePathForOpen(uri, meta)
  void shell.openPath(full)
}

/** 另存为：将附件复制到用户选择的路径（可按需下载） */
export async function downloadAttachment(
  parent: BrowserWindow | undefined,
  uri: string,
  suggestedName?: string,
  meta?: AttachmentOpenMeta
): Promise<boolean> {
  const full = await ensurePathForOpen(uri, meta)
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
export async function openAttachmentUriOrFileUrl(
  uriOrFile: string,
  meta?: AttachmentOpenMeta
): Promise<void> {
  if (uriOrFile.startsWith('file://')) {
    void shell.openPath(fileURLToPath(uriOrFile))
    return
  }
  await openAttachmentPath(uriOrFile, meta)
}

export type { AttachmentOpenMeta }

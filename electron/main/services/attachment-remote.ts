import crypto from 'crypto'
import {
  ATTACHMENT_SERVER_MAX_BYTES,
  isOverServerAttachmentLimit,
  type AttachmentPrefs
} from '@shared/attachment-storage'
import type { SavedAttachment } from '@shared/attachment'
import type { TaskFileAttachment } from '@shared/task-description'
import type { S3Secrets } from '../s3-credentials'
import { downloadS3Object, uploadS3Object, type S3ClientConfig } from './s3-attachment-client'

export type AttachmentAuth = { baseUrl: string; accessToken: string }

export type AttachmentRemoteHooks = {
  getPrefs: () => AttachmentPrefs
  getAuth: () => AttachmentAuth | null
  getS3Secrets: () => S3Secrets | null
  /** 可注入以便单测 */
  uploadServer?: (auth: AttachmentAuth, name: string, buffer: Buffer) => Promise<{ id: string; sha256: string }>
  downloadServer?: (auth: AttachmentAuth, remoteId: string) => Promise<Buffer>
  uploadS3?: (cfg: S3ClientConfig, objectKey: string, buffer: Buffer) => Promise<void>
  downloadS3?: (cfg: S3ClientConfig, objectKey: string) => Promise<Buffer>
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function defaultUploadServer(
  auth: AttachmentAuth,
  name: string,
  buffer: Buffer
): Promise<{ id: string; sha256: string }> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)]), name)
  const res = await fetch(`${auth.baseUrl.replace(/\/+$/, '')}/api/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    body: form
  })
  const json = (await res.json()) as {
    code: number
    message?: string
    data?: { id: string; sha256: string }
  }
  if (!res.ok || json.code !== 0 || !json.data?.id) {
    throw new Error(json.message || `服务端上传失败 (${res.status})`)
  }
  return { id: json.data.id, sha256: json.data.sha256 || sha256Hex(buffer) }
}

export async function defaultDownloadServer(auth: AttachmentAuth, remoteId: string): Promise<Buffer> {
  const res = await fetch(
    `${auth.baseUrl.replace(/\/+$/, '')}/api/attachments/${encodeURIComponent(remoteId)}`,
    { headers: { Authorization: `Bearer ${auth.accessToken}` } }
  )
  if (!res.ok) {
    throw new Error(`服务端下载失败 (${res.status})`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * 本机已写入后，按偏好尝试远端上传并回填元数据。
 * 上传失败不抛出（本地仍可用），通过 uploadError 回传。
 */
export async function applyRemoteUploadAfterLocalSave(
  local: SavedAttachment,
  buffer: Buffer,
  hooks: AttachmentRemoteHooks
): Promise<SavedAttachment> {
  const prefs = hooks.getPrefs()
  const size = buffer.length
  const base: SavedAttachment = {
    ...local,
    storage: prefs.mode,
    size
  }

  if (prefs.mode === 'local') {
    return { ...base, storage: 'local' }
  }

  if (prefs.mode === 'server') {
    if (isOverServerAttachmentLimit(size)) {
      throw new Error(`服务端附件不能超过 ${Math.floor(ATTACHMENT_SERVER_MAX_BYTES / (1024 * 1024))}MB`)
    }
    const auth = hooks.getAuth()
    if (!auth) {
      throw new Error('服务端附件需先登录账号与同步')
    }
    try {
      const upload = hooks.uploadServer ?? defaultUploadServer
      const remote = await upload(auth, local.name, buffer)
      return {
        ...base,
        storage: 'server',
        remoteId: remote.id,
        sha256: remote.sha256
      }
    } catch (err) {
      return {
        ...base,
        storage: 'server',
        uploadError: err instanceof Error ? err.message : '上传到服务端失败'
      }
    }
  }

  // s3
  const secrets = hooks.getS3Secrets()
  const s3 = prefs.s3
  if (!s3?.endpoint || !s3.bucket || !secrets) {
    throw new Error('请先在附件管理中配置并测试 S3')
  }
  const cfg: S3ClientConfig = { ...s3, ...secrets }
  const objectKey = local.uri.startsWith('aitodo-attachment://')
    ? local.uri.slice('aitodo-attachment://'.length)
    : `attachments/${local.name}`
  try {
    const upload = hooks.uploadS3 ?? uploadS3Object
    await upload(cfg, objectKey, buffer)
    return {
      ...base,
      storage: 's3',
      objectKey,
      sha256: sha256Hex(buffer)
    }
  } catch (err) {
    return {
      ...base,
      storage: 's3',
      objectKey,
      uploadError: err instanceof Error ? err.message : '上传到 S3 失败'
    }
  }
}

export type AttachmentOpenMeta = Pick<TaskFileAttachment, 'storage' | 'remoteId' | 'objectKey'>

/**
 * 确保本机文件存在：命中直接返回路径；miss 时按 storage 下载写入 path。
 * local / 无远端身份 miss → 抛「附件不存在」类错误。
 */
export async function ensureLocalAttachmentFile(
  absolutePath: string,
  uri: string,
  meta: AttachmentOpenMeta | undefined,
  writeFile: (path: string, buf: Buffer) => void,
  fileExists: (path: string) => boolean,
  hooks: AttachmentRemoteHooks
): Promise<string> {
  if (fileExists(absolutePath)) {
    return absolutePath
  }

  const storage = meta?.storage
  if (storage === 'server' && meta?.remoteId) {
    const auth = hooks.getAuth()
    if (!auth) throw new Error('未登录，无法从服务端下载附件')
    const download = hooks.downloadServer ?? defaultDownloadServer
    const buf = await download(auth, meta.remoteId)
    writeFile(absolutePath, buf)
    return absolutePath
  }

  if (storage === 's3' && meta?.objectKey) {
    const secrets = hooks.getS3Secrets()
    const s3 = hooks.getPrefs().s3
    if (!s3 || !secrets) throw new Error('S3 未配置，无法下载附件')
    const cfg: S3ClientConfig = { ...s3, ...secrets }
    const download = hooks.downloadS3 ?? downloadS3Object
    const buf = await download(cfg, meta.objectKey)
    writeFile(absolutePath, buf)
    return absolutePath
  }

  throw new Error('附件不存在（仅本地存储或远端信息缺失）')
}

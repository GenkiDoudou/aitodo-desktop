/** 任务附件远端存储模式 */
export type AttachmentStorageMode = 'local' | 'server' | 's3'

/** 服务端单文件上限（字节） */
export const ATTACHMENT_SERVER_MAX_BYTES = 20 * 1024 * 1024

/** S3 兼容非密钥字段（可进 desktop-config / app_settings） */
export interface AttachmentS3PublicConfig {
  endpoint: string
  bucket: string
  region?: string
}

/** 本机附件偏好（不含 AK/SK 本体；可含是否同步密钥的开关） */
export interface AttachmentPrefs {
  mode: AttachmentStorageMode
  s3?: AttachmentS3PublicConfig
  /** 是否把 S3 AK/SK 一并写入 app_settings 同步；默认 false */
  syncS3Secrets?: boolean
}

export const DEFAULT_ATTACHMENT_PREFS: AttachmentPrefs = {
  mode: 'local',
  syncS3Secrets: false
}

export function mergeAttachmentPrefs(raw?: unknown): AttachmentPrefs {
  const base: AttachmentPrefs = { ...DEFAULT_ATTACHMENT_PREFS }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const mode: AttachmentStorageMode =
    o.mode === 'local' || o.mode === 'server' || o.mode === 's3' ? o.mode : base.mode
  let s3: AttachmentS3PublicConfig | undefined
  if (o.s3 && typeof o.s3 === 'object') {
    const s = o.s3 as Record<string, unknown>
    const endpoint = typeof s.endpoint === 'string' ? s.endpoint.trim() : ''
    const bucket = typeof s.bucket === 'string' ? s.bucket.trim() : ''
    const region = typeof s.region === 'string' ? s.region.trim() : undefined
    if (endpoint || bucket || region) {
      s3 = {
        endpoint,
        bucket,
        ...(region ? { region } : {})
      }
    }
  }
  const syncS3Secrets =
    typeof o.syncS3Secrets === 'boolean' ? o.syncS3Secrets : base.syncS3Secrets
  // 拒绝把密钥字段误写入偏好本体
  return { mode, syncS3Secrets, ...(s3 ? { s3 } : {}) }
}

/** 供 app_settings 同步：偏好本体不含 AK/SK */
export function attachmentPrefsForSync(prefs: AttachmentPrefs): AttachmentPrefs {
  return mergeAttachmentPrefs(prefs)
}

export type AttachmentS3Secrets = { accessKey: string; secretKey: string }

/**
 * 仅在用户开启 syncS3Secrets 且本机有密钥时，才把密钥放入同步载荷。
 */
export function attachmentS3SecretsForSync(
  prefs: AttachmentPrefs,
  secrets: AttachmentS3Secrets | null
): AttachmentS3Secrets | undefined {
  if (!prefs.syncS3Secrets || !secrets) return undefined
  if (!secrets.accessKey?.trim() || !secrets.secretKey?.trim()) return undefined
  return { accessKey: secrets.accessKey, secretKey: secrets.secretKey }
}

export function parseAttachmentS3Secrets(raw: unknown): AttachmentS3Secrets | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.accessKey !== 'string' || typeof o.secretKey !== 'string') return null
  if (!o.accessKey.trim() || !o.secretKey.trim()) return null
  return { accessKey: o.accessKey, secretKey: o.secretKey }
}

export function isOverServerAttachmentLimit(sizeBytes: number): boolean {
  return sizeBytes > ATTACHMENT_SERVER_MAX_BYTES
}

export function validateS3PublicConfig(cfg: AttachmentS3PublicConfig): string | null {
  if (!cfg.endpoint?.trim()) return '请填写 Endpoint'
  if (!cfg.bucket?.trim()) return '请填写 Bucket'
  try {
    // eslint-disable-next-line no-new
    new URL(cfg.endpoint)
  } catch {
    return 'Endpoint 不是合法 URL'
  }
  return null
}

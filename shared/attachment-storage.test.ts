import { describe, expect, it } from 'vitest'
import {
  attachmentPrefsForSync,
  attachmentS3SecretsForSync,
  DEFAULT_ATTACHMENT_PREFS,
  isOverServerAttachmentLimit,
  ATTACHMENT_SERVER_MAX_BYTES,
  mergeAttachmentPrefs,
  parseAttachmentS3Secrets,
  validateS3PublicConfig
} from './attachment-storage'

describe('attachment-storage prefs', () => {
  it('defaults to local without syncing secrets', () => {
    expect(mergeAttachmentPrefs(undefined)).toEqual(DEFAULT_ATTACHMENT_PREFS)
    expect(mergeAttachmentPrefs({})).toEqual({ mode: 'local', syncS3Secrets: false })
  })

  it('merges mode, sync flag and non-secret s3 fields', () => {
    expect(
      mergeAttachmentPrefs({
        mode: 's3',
        syncS3Secrets: true,
        s3: { endpoint: 'https://s3.example.com', bucket: 'b1', region: 'us-east-1' },
        accessKey: 'leak',
        secretKey: 'leak2'
      })
    ).toEqual({
      mode: 's3',
      syncS3Secrets: true,
      s3: { endpoint: 'https://s3.example.com', bucket: 'b1', region: 'us-east-1' }
    })
  })

  it('prefs sync payload never embeds raw secret keys', () => {
    const synced = attachmentPrefsForSync(
      mergeAttachmentPrefs({
        mode: 'server',
        accessKeyId: 'ak',
        secretAccessKey: 'sk'
      }) as never
    )
    expect(synced).toEqual({ mode: 'server', syncS3Secrets: false })
    expect(JSON.stringify(synced)).not.toMatch(/accessKeyId|secretAccessKey|"ak"|"sk"/)
  })

  it('only includes secrets for sync when user opted in', () => {
    const secrets = { accessKey: 'ak', secretKey: 'sk' }
    expect(
      attachmentS3SecretsForSync({ mode: 's3', syncS3Secrets: false }, secrets)
    ).toBeUndefined()
    expect(
      attachmentS3SecretsForSync({ mode: 's3', syncS3Secrets: true }, null)
    ).toBeUndefined()
    expect(attachmentS3SecretsForSync({ mode: 's3', syncS3Secrets: true }, secrets)).toEqual(
      secrets
    )
  })

  it('parses remote secret payload', () => {
    expect(parseAttachmentS3Secrets({ accessKey: 'a', secretKey: 'b' })).toEqual({
      accessKey: 'a',
      secretKey: 'b'
    })
    expect(parseAttachmentS3Secrets({ accessKey: '', secretKey: 'b' })).toBeNull()
  })

  it('detects server size limit', () => {
    expect(isOverServerAttachmentLimit(ATTACHMENT_SERVER_MAX_BYTES)).toBe(false)
    expect(isOverServerAttachmentLimit(ATTACHMENT_SERVER_MAX_BYTES + 1)).toBe(true)
  })

  it('validates s3 public config', () => {
    expect(validateS3PublicConfig({ endpoint: '', bucket: 'b' })).toBeTruthy()
    expect(validateS3PublicConfig({ endpoint: 'not-url', bucket: 'b' })).toBeTruthy()
    expect(validateS3PublicConfig({ endpoint: 'https://s3.example.com', bucket: 'b' })).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  applyRemoteUploadAfterLocalSave,
  ensureLocalAttachmentFile
} from './attachment-remote'
import type { SavedAttachment } from '@shared/attachment'
import { ATTACHMENT_SERVER_MAX_BYTES } from '@shared/attachment-storage'

const local: SavedAttachment = {
  uri: 'aitodo-attachment://attachments/u-a.pdf',
  name: 'a.pdf',
  isImage: false
}

describe('attachment-remote', () => {
  it('local mode skips upload', async () => {
    const out = await applyRemoteUploadAfterLocalSave(local, Buffer.from('x'), {
      getPrefs: () => ({ mode: 'local' }),
      getAuth: () => null,
      getS3Secrets: () => null,
      uploadServer: vi.fn()
    })
    expect(out.storage).toBe('local')
    expect(out.uploadError).toBeUndefined()
  })

  it('server mode rejects oversize before upload', async () => {
    const uploadServer = vi.fn()
    await expect(
      applyRemoteUploadAfterLocalSave(local, Buffer.alloc(ATTACHMENT_SERVER_MAX_BYTES + 1), {
        getPrefs: () => ({ mode: 'server' }),
        getAuth: () => ({ baseUrl: 'http://x', accessToken: 't' }),
        getS3Secrets: () => null,
        uploadServer
      })
    ).rejects.toThrow(/20/)
    expect(uploadServer).not.toHaveBeenCalled()
  })

  it('server upload success fills remoteId', async () => {
    const out = await applyRemoteUploadAfterLocalSave(local, Buffer.from('hi'), {
      getPrefs: () => ({ mode: 'server' }),
      getAuth: () => ({ baseUrl: 'http://x', accessToken: 't' }),
      getS3Secrets: () => null,
      uploadServer: async () => ({ id: 'rid-1', sha256: 'abc' })
    })
    expect(out.remoteId).toBe('rid-1')
    expect(out.sha256).toBe('abc')
    expect(out.uploadError).toBeUndefined()
  })

  it('server upload failure keeps local and sets uploadError', async () => {
    const out = await applyRemoteUploadAfterLocalSave(local, Buffer.from('hi'), {
      getPrefs: () => ({ mode: 'server' }),
      getAuth: () => ({ baseUrl: 'http://x', accessToken: 't' }),
      getS3Secrets: () => null,
      uploadServer: async () => {
        throw new Error('network')
      }
    })
    expect(out.uri).toBe(local.uri)
    expect(out.uploadError).toContain('network')
  })

  it('open: local miss without remote shows broken link', async () => {
    await expect(
      ensureLocalAttachmentFile(
        '/tmp/missing.pdf',
        local.uri,
        { storage: 'local' },
        () => undefined,
        () => false,
        {
          getPrefs: () => ({ mode: 'local' }),
          getAuth: () => null,
          getS3Secrets: () => null
        }
      )
    ).rejects.toThrow(/不存在/)
  })

  it('open: server miss downloads then writes', async () => {
    const written: Buffer[] = []
    const path = await ensureLocalAttachmentFile(
      '/tmp/dl.pdf',
      local.uri,
      { storage: 'server', remoteId: 'r1' },
      (_p, buf) => written.push(buf),
      () => false,
      {
        getPrefs: () => ({ mode: 'server' }),
        getAuth: () => ({ baseUrl: 'http://x', accessToken: 't' }),
        getS3Secrets: () => null,
        downloadServer: async () => Buffer.from('remote-bytes')
      }
    )
    expect(path).toBe('/tmp/dl.pdf')
    expect(written[0]?.toString()).toBe('remote-bytes')
  })
})

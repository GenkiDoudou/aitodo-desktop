import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitodo-attach-'))

vi.mock('../db/database', () => ({
  getActiveDataDir: () => dataDir
}))

import { resolveAttachmentPath, resolveAttachmentPathFromRequest, saveAttachmentBuffer } from './attachment-service'

describe('attachment-service', () => {
  it('saves buffer and resolves path', () => {
    const saved = saveAttachmentBuffer('note.pdf', Buffer.from('hello'))
    expect(saved.uri).toMatch(/^aitodo-attachment:\/\/attachments\//)
    expect(saved.name).toBe('note.pdf')
    expect(saved.isImage).toBe(false)
    const full = resolveAttachmentPath(saved.uri)
    expect(full).toBeTruthy()
    expect(fs.readFileSync(full!, 'utf8')).toBe('hello')
  })

  it('detects image extension', () => {
    const saved = saveAttachmentBuffer('photo.PNG', Buffer.from([1, 2, 3]))
    expect(saved.isImage).toBe(true)
  })

  it('resolves from protocol request URL with query string', () => {
    const saved = saveAttachmentBuffer('pic.png', Buffer.from('png'))
    const full = resolveAttachmentPath(saved.uri)
    expect(resolveAttachmentPathFromRequest(`${saved.uri}?t=1`)).toBe(full)
  })
})

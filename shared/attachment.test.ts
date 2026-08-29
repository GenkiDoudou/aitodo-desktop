import { describe, expect, it } from 'vitest'
import { extractAttachmentUris, isImageFileName } from './attachment'

describe('attachment', () => {
  it('extracts unique attachment uris', () => {
    const md = '![a](aitodo-attachment://attachments/x.png) and [b](aitodo-attachment://attachments/y.pdf)'
    expect(extractAttachmentUris(md)).toEqual([
      'aitodo-attachment://attachments/x.png',
      'aitodo-attachment://attachments/y.pdf'
    ])
  })

  it('detects image file names', () => {
    expect(isImageFileName('a.JPG')).toBe(true)
    expect(isImageFileName('doc.zip')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../src/utils/wysiwyg-markdown'

describe('wysiwyg-markdown', () => {
  it('converts basic html to markdown', () => {
    expect(htmlToMarkdown('<p><strong>hi</strong></p>')).toBe('**hi**')
  })

  it('preserves attachment image uri', () => {
    const html =
      '<img src="aitodo-attachment://attachments/x.png" alt="a" data-attachment-uri="aitodo-attachment://attachments/x.png" />'
    expect(htmlToMarkdown(html)).toBe('![a](aitodo-attachment://attachments/x.png)')
  })

  it('returns empty for blank editor', () => {
    expect(htmlToMarkdown('<br>')).toBe('')
  })
})

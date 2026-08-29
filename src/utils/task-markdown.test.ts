import { describe, expect, it } from 'vitest'
import { renderTaskMarkdownHtml } from './task-markdown'

describe('task-markdown', () => {
  it('renders task list', () => {
    const html = renderTaskMarkdownHtml('- [ ] todo\n- [x] done')
    expect(html).toContain('task-list')
    expect(html).toContain('checkbox')
  })

  it('renders highlight mark', () => {
    const html = renderTaskMarkdownHtml('==highlight==')
    expect(html).toContain('<mark>')
  })

  it('renders attachment image uri unchanged', () => {
    const md = '![pic](aitodo-attachment://attachments/a.png)'
    const html = renderTaskMarkdownHtml(md)
    expect(html).toContain('aitodo-attachment://attachments/a.png')
  })
})

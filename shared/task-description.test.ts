import { describe, expect, it } from 'vitest'
import { parseTaskDescription, serializeTaskDescription } from './task-description'

describe('task-description', () => {
  it('round-trips body with attachment metadata comment', () => {
    const body = '# Hello\n\nSome text'
    const attachments = [{ uri: 'aitodo-attachment://attachments/uuid-note.pdf', name: 'note.pdf' }]
    const raw = serializeTaskDescription(body, attachments)
    expect(raw).toContain('<!-- aitodo-attachments:')
    const parsed = parseTaskDescription(raw)
    expect(parsed.body).toBe(body)
    expect(parsed.attachments).toEqual(attachments)
  })

  it('migrates legacy non-image link from body to attachments', () => {
    const raw = '正文\n\n[📎 报告.pdf](aitodo-attachment://attachments/x-报告.pdf)'
    const parsed = parseTaskDescription(raw)
    expect(parsed.body).toBe('正文')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0].name).toBe('报告.pdf')
  })

  it('keeps image markdown in body', () => {
    const raw = '![图](aitodo-attachment://attachments/x.png)'
    const parsed = parseTaskDescription(raw)
    expect(parsed.body).toBe(raw)
    expect(parsed.attachments).toHaveLength(0)
  })
})

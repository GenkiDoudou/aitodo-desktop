import { ATTACHMENT_SCHEME, isImageFileName, type SavedAttachment } from './attachment'

/** 任务正文外置附件元数据（非图片文件，不写入 Markdown 正文） */
export interface TaskFileAttachment {
  uri: string
  name: string
}

const ATTACHMENTS_MARKER = '<!-- aitodo-attachments:'
const ATTACHMENTS_END = '-->'

/** 匹配正文内遗留的非图片附件链接（不含 ![ 图片语法） */
const LEGACY_FILE_LINK_RE = /(?<!!)\[([^\]]*)\]\((aitodo-attachment:\/\/[^\s)]+)\)/g

function dedupeAttachments(items: TaskFileAttachment[]): TaskFileAttachment[] {
  const map = new Map<string, TaskFileAttachment>()
  for (const item of items) {
    if (!item.uri.startsWith(ATTACHMENT_SCHEME)) continue
    map.set(item.uri, { uri: item.uri, name: item.name || '附件' })
  }
  return [...map.values()]
}

function fileNameFromUri(uri: string): string {
  const seg = uri.split('/').pop() ?? '附件'
  const dash = seg.indexOf('-')
  return dash >= 0 ? seg.slice(dash + 1) : seg
}

function isNonImageAttachmentUri(uri: string, label: string): boolean {
  const fromUri = fileNameFromUri(uri)
  if (isImageFileName(fromUri)) return false
  const cleanLabel = label.replace(/^📎\s*/, '').trim()
  if (cleanLabel && isImageFileName(cleanLabel)) return false
  return true
}

/**
 * 从 description 拆出「正文 Markdown」与「外置附件列表」。
 * - 末尾 `<!-- aitodo-attachments:[...]-->` 为附件元数据
 * - 旧数据中带 `[📎 name](aitodo-attachment://...)` 的非图片链接会迁到 attachments 并从正文移除
 */
export function parseTaskDescription(raw: string | null | undefined): {
  body: string
  attachments: TaskFileAttachment[]
} {
  if (!raw?.trim()) {
    return { body: '', attachments: [] }
  }

  let text = raw
  let attachments: TaskFileAttachment[] = []

  const commentRe = /<!--\s*aitodo-attachments:(\[[\s\S]*?\])\s*-->\s*$/
  const commentMatch = text.match(commentRe)
  if (commentMatch?.index !== undefined) {
    try {
      const parsed = JSON.parse(commentMatch[1]) as TaskFileAttachment[]
      if (Array.isArray(parsed)) {
        attachments = parsed.filter((a) => a?.uri?.startsWith(ATTACHMENT_SCHEME))
      }
    } catch {
      /* 注释损坏时忽略，仅剥离注释块 */
    }
    text = text.slice(0, commentMatch.index).trimEnd()
  }

  const migrated: TaskFileAttachment[] = []
  const body = text
    .replace(LEGACY_FILE_LINK_RE, (full, label: string, uri: string) => {
      if (!isNonImageAttachmentUri(uri, label)) {
        return full
      }
      const name = label.replace(/^📎\s*/, '').trim() || fileNameFromUri(uri)
      migrated.push({ uri, name })
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    body,
    attachments: dedupeAttachments([...attachments, ...migrated])
  }
}

/** 看板卡片：正文纯文本摘要 */
export function taskDescriptionPreview(raw: string | null | undefined, maxLen = 60): string {
  const { body } = parseTaskDescription(raw)
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return ''
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen)}…`
}

/** 合并正文与外置附件为 description 存储字符串 */
export function serializeTaskDescription(
  body: string,
  attachments: TaskFileAttachment[]
): string {
  const trimmedBody = body.trim()
  const list = dedupeAttachments(attachments)
  if (!list.length) {
    return trimmedBody
  }
  const payload = `${ATTACHMENTS_MARKER}${JSON.stringify(list)}${ATTACHMENTS_END}`
  return trimmedBody ? `${trimmedBody}\n\n${payload}` : payload
}

/** pickAttachment / saveAttachment 结果写入外置列表 */
export function savedAttachmentToFileMeta(saved: SavedAttachment): TaskFileAttachment {
  return { uri: saved.uri, name: saved.name }
}

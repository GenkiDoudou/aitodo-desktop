import TurndownService from 'turndown'
import { ATTACHMENT_SCHEME } from '@shared/attachment'

let turndown: TurndownService | null = null

/** 获取 Turndown 实例（HTML → Markdown，与任务正文存储格式对齐） */
function getTurndown(): TurndownService {
  if (turndown) return turndown
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  })

  /** 保留附件图片 URI（wysiwyg 中 img 带 data-attachment-uri） */
  td.addRule('attachmentImage', {
    filter: (node) => node.nodeName === 'IMG',
    replacement: (_content, node) => {
      const el = node as HTMLImageElement
      const uri =
        el.getAttribute('data-attachment-uri') ||
        (el.getAttribute('src')?.startsWith(ATTACHMENT_SCHEME) ? el.getAttribute('src') : null)
      const alt = el.getAttribute('alt') || '图片'
      if (uri?.startsWith(ATTACHMENT_SCHEME)) {
        return `![${alt}](${uri})`
      }
      const src = el.getAttribute('src') ?? ''
      return src ? `![${alt}](${src})` : ''
    }
  })

  /** 附件链接 */
  td.addRule('attachmentLink', {
    filter: (node) => {
      if (node.nodeName !== 'A') return false
      const href = (node as HTMLAnchorElement).getAttribute('href') ?? ''
      return href.startsWith(ATTACHMENT_SCHEME) || href.startsWith('file://')
    },
    replacement: (content, node) => {
      const el = node as HTMLAnchorElement
      const uri =
        el.getAttribute('data-attachment-uri') ||
        (el.getAttribute('href')?.startsWith(ATTACHMENT_SCHEME) ? el.getAttribute('href') : null)
      const text = content.trim() || el.getAttribute('title') || '附件'
      if (uri?.startsWith(ATTACHMENT_SCHEME)) {
        return `[${text}](${uri})`
      }
      return `[${text}](${el.getAttribute('href') ?? ''})`
    }
  })

  td.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`
  })

  turndown = td
  return td
}

/** 将 contenteditable 的 HTML 转为 Markdown 存入 description */
export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') {
    return ''
  }
  return getTurndown().turndown(trimmed).trim()
}

/** 在 wysiwyg 中插入图片（src 使用 aitodo-attachment://，由主进程协议映射本地文件） */
export function buildWysiwygImageHtml(alt: string, attachmentUri: string): string {
  const safeAlt = alt.replace(/"/g, '&quot;')
  return `<img src="${attachmentUri}" alt="${safeAlt}" data-attachment-uri="${attachmentUri}" />`
}

/** 在 wysiwyg 中插入附件链接 */
export function buildWysiwygLinkHtml(label: string, attachmentUri: string): string {
  return `<a href="${attachmentUri}" data-attachment-uri="${attachmentUri}">📎 ${label}</a>`
}

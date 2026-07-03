import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import mark from 'markdown-it-mark'

let mdInstance: MarkdownIt | null = null

/**
 * 任务正文 Markdown 渲染器（GFM 子集）。
 * 与 TipTap/tiptap-markdown 输出对齐：列表、待办、删除线、高亮等。
 */
export function createTaskMarkdownIt(): MarkdownIt {
  if (mdInstance) return mdInstance
  mdInstance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false
  })
    .use(taskLists, { enabled: true, label: true, labelAfter: true })
    .use(mark)
  return mdInstance
}

/** 将 Markdown 渲染为 HTML（预览 / 分屏右侧） */
export function renderTaskMarkdownHtml(markdown: string): string {
  if (!markdown.trim()) {
    return ''
  }
  return createTaskMarkdownIt().render(markdown)
}

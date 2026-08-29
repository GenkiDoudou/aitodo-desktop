/** Markdown 快捷插入工具（任务正文编辑器工具栏） */
export interface MarkdownTool {
  key: string
  label: string
  short: string
  prefix: string
  suffix: string
  placeholder?: string
  block?: boolean
}

export const MARKDOWN_TOOLS: MarkdownTool[] = [
  { key: 'b', label: '加粗', short: 'B', prefix: '**', suffix: '**', placeholder: '文字' },
  { key: 'i', label: '斜体', short: 'I', prefix: '*', suffix: '*', placeholder: '文字' },
  { key: 'mark', label: '高亮', short: 'H', prefix: '==', suffix: '==', placeholder: '文字' },
  { key: 'strike', label: '删除线', short: 'S', prefix: '~~', suffix: '~~', placeholder: '文字' },
  { key: 'code', label: '行内代码', short: '</>', prefix: '`', suffix: '`', placeholder: 'code' },
  { key: 'h1', label: '一级标题', short: 'H1', prefix: '# ', suffix: '', block: true, placeholder: '标题' },
  { key: 'h2', label: '二级标题', short: 'H2', prefix: '## ', suffix: '', block: true, placeholder: '标题' },
  { key: 'ul', label: '无序列表', short: '≡', prefix: '- ', suffix: '', block: true, placeholder: '条目' },
  { key: 'ol', label: '有序列表', short: '1.', prefix: '1. ', suffix: '', block: true, placeholder: '条目' },
  { key: 'check', label: '待办', short: '☑', prefix: '- [ ] ', suffix: '', block: true, placeholder: '待办' },
  { key: 'quote', label: '引用', short: '❝', prefix: '> ', suffix: '', block: true, placeholder: '引用' },
  { key: 'link', label: '链接', short: '🔗', prefix: '[', suffix: '](https://)', placeholder: '文字' },
  { key: 'hr', label: '分割线', short: '—', prefix: '\n---\n', suffix: '', block: true }
]

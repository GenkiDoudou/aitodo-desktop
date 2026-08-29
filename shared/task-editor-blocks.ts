/**
 * 任务正文编辑器「/」插入菜单项定义。
 * 插入内容统一为 Markdown，与 description 字段存储格式一致。
 */
export type SlashMenuGroup = 'format' | 'insert'

export interface SlashMenuItem {
  id: string
  group: SlashMenuGroup
  label: string
  /** 菜单左侧图标字符（v1 无图标库依赖时用简字） */
  icon: string
  /** 搜索关键字（拼音首字母等） */
  keywords: string
  /** 插入到光标的 Markdown 片段；{cursor} 表示插入后光标位置 */
  insert: string
  /** 若为 true，在独立一行插入（替换当前行前缀 /xxx） */
  block?: boolean
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    id: 'h1',
    group: 'format',
    label: 'H1 一级标题',
    icon: 'H1',
    keywords: 'h1 标题',
    insert: '# {cursor}',
    block: true
  },
  {
    id: 'h2',
    group: 'format',
    label: 'H2 二级标题',
    icon: 'H2',
    keywords: 'h2 标题',
    insert: '## {cursor}',
    block: true
  },
  {
    id: 'h3',
    group: 'format',
    label: 'H3 三级标题',
    icon: 'H3',
    keywords: 'h3 标题',
    insert: '### {cursor}',
    block: true
  },
  {
    id: 'ul',
    group: 'format',
    label: '无序列表',
    icon: '≡',
    keywords: '列表 无序',
    insert: '- {cursor}',
    block: true
  },
  {
    id: 'ol',
    group: 'format',
    label: '有序列表',
    icon: '1.',
    keywords: '列表 有序 编号',
    insert: '1. {cursor}',
    block: true
  },
  {
    id: 'check',
    group: 'format',
    label: '检查项',
    icon: '☑',
    keywords: '待办 检查 勾选',
    insert: '- [ ] {cursor}',
    block: true
  },
  {
    id: 'quote',
    group: 'format',
    label: '引用',
    icon: '❝',
    keywords: '引用',
    insert: '> {cursor}',
    block: true
  },
  {
    id: 'hr',
    group: 'format',
    label: '水平分割线',
    icon: '—',
    keywords: '分割 分隔线',
    insert: '\n---\n{cursor}',
    block: true
  },
  {
    id: 'attach',
    group: 'insert',
    label: '附件',
    icon: '📎',
    keywords: '附件 文件',
    insert: '[附件名称]({cursor})',
    block: true
  },
  {
    id: 'subtask',
    group: 'insert',
    label: '子任务',
    icon: '⊞',
    keywords: '子任务',
    insert: '',
    block: false
  },
  {
    id: 'tag',
    group: 'insert',
    label: '标签',
    icon: '#',
    keywords: '标签 tag',
    insert: '#标签{cursor}',
    block: false
  },
  {
    id: 'link',
    group: 'insert',
    label: '关联任务/笔记',
    icon: '🔗',
    keywords: '链接 关联',
    insert: '[关联内容]({cursor})',
    block: false
  }
]

export function filterSlashMenuItems(query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_MENU_ITEMS
  return SLASH_MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q) ||
      item.id.includes(q)
  )
}

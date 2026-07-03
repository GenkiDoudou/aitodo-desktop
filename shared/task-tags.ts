/**
 * 从任务标题与正文提取 #标签（v1 无独立标签表，与编辑器 #标签 块一致）。
 * 正文为 Markdown/HTML 时仅做轻量剥离后匹配。
 */
export function stripMarkupForTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~>-]/g, ' ')
}

export function extractTaskTags(task: { title: string; description?: string | null }): string[] {
  const raw = `${task.title} ${stripMarkupForTags(task.description ?? '')}`
  const found = new Set<string>()
  const re = /#([\u4e00-\u9fa5\w-]{1,32})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    found.add(m[1])
  }
  return [...found].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 排序/分组用：首个标签，无则空串 */
export function primaryTaskTag(task: { title: string; description?: string | null }): string {
  return extractTaskTags(task)[0] ?? ''
}

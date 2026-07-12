/** 标签名：中文、字母数字、连字符，1–32 字符 */
const TAG_NAME_RE = /^[\u4e00-\u9fa5\w-]{1,32}$/

export function stripMarkupForTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~>-]/g, ' ')
}

/** 从纯文本中解析 #标签（兼容旧数据） */
export function extractTagsFromText(title: string, description?: string | null): string[] {
  const raw = `${title} ${stripMarkupForTags(description ?? '')}`
  const found = new Set<string>()
  const re = /#([\u4e00-\u9fa5\w-]{1,32})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    found.add(m[1])
  }
  return [...found].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 规范化单个标签名；非法则返回 null */
export function normalizeTagName(raw: string): string | null {
  const name = raw.trim().replace(/^#+/, '')
  if (!name || !TAG_NAME_RE.test(name)) {
    return null
  }
  return name
}

/** 去重、校验并排序标签列表 */
export function normalizeTagNames(names: readonly string[]): string[] {
  const set = new Set<string>()
  for (const raw of names) {
    const norm = normalizeTagName(raw)
    if (norm) {
      set.add(norm)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/**
 * 任务标签列表：优先使用持久化字段，否则从标题/正文解析（旧数据兼容）。
 */
export function extractTaskTags(task: {
  title: string
  description?: string | null
  tags?: string[]
}): string[] {
  if (task.tags?.length) {
    return [...task.tags].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }
  return extractTagsFromText(task.title, task.description)
}

/** 排序/分组用：首个标签，无则空串 */
export function primaryTaskTag(task: {
  title: string
  description?: string | null
  tags?: string[]
}): string {
  return extractTaskTags(task)[0] ?? ''
}

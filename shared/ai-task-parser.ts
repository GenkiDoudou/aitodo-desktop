import dayjs from 'dayjs'

/** 解析时可匹配的分类摘要（id + 展示名） */
export interface AiParseCategoryRef {
  id: string
  name: string
}

/** 规则解析结果：供 AI Dialog 预览与创建任务 DTO 组装 */
export interface AiParsedTaskDraft {
  title: string
  dueAt: string | null
  remindAt: string | null
  category: AiParseCategoryRef | null
  /** 非致命提示，如未能识别时间时建议用户手改 */
  warnings: string[]
}

export interface AiParseOptions {
  categories: AiParseCategoryRef[]
  /** 单元测试注入「当前时刻」，默认取本机 now */
  now?: dayjs.Dayjs
}

/** ISO 本地时间：yyyy-MM-ddTHH:mm:ss（与仓库 Task 字段一致） */
function toIso(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DDTHH:mm:ss')
}

/** 去掉已匹配片段并规整空白/标点 */
function cleanupTitle(raw: string): string {
  return raw
    .replace(/[，,。；;、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 相对日偏移：今天/明天/后天/大后天 */
function resolveDayOffset(text: string, base: dayjs.Dayjs): dayjs.Dayjs | null {
  if (/今天|今日/.test(text)) return base.startOf('day')
  if (/明天|明日/.test(text)) return base.add(1, 'day').startOf('day')
  if (/后天/.test(text)) return base.add(2, 'day').startOf('day')
  if (/大后天/.test(text)) return base.add(3, 'day').startOf('day')
  const md = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (md) {
    const month = Number(md[1])
    const day = Number(md[2])
    let candidate = base.month(month - 1).date(day).startOf('day')
    if (candidate.isBefore(base.startOf('day'))) {
      candidate = candidate.add(1, 'year')
    }
    return candidate
  }
  return null
}

/** 从片段解析时刻；缺省 9:00，仅「下午3点」类表达会覆盖小时 */
function resolveClock(text: string, day: dayjs.Dayjs): dayjs.Dayjs {
  let hour = 9
  let minute = 0

  const half = text.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})\s*点半/)
  if (half) {
    hour = Number(half[2])
    minute = 30
    const period = half[1]
    if (period === '下午' || period === '晚上') {
      if (hour < 12) hour += 12
    } else if (period === '中午' && hour <= 12) {
      hour = hour === 12 ? 12 : hour + 12
    }
    return day.hour(hour).minute(minute).second(0)
  }

  const full = text.match(
    /(上午|下午|晚上|中午)?\s*(\d{1,2})\s*点\s*(\d{1,2})?\s*分?/
  )
  if (full) {
    hour = Number(full[2])
    minute = full[3] ? Number(full[3]) : 0
    const period = full[1]
    if (period === '下午' || period === '晚上') {
      if (hour < 12) hour += 12
    } else if (period === '中午') {
      hour = hour <= 12 ? (hour === 12 ? 12 : hour + 12) : hour
    }
    return day.hour(hour).minute(minute).second(0)
  }

  return day.hour(hour).minute(minute).second(0)
}

/** 提取截止时刻相关片段 */
function extractDue(
  text: string,
  base: dayjs.Dayjs
): { dueAt: string | null; consumed: string[] } {
  const consumed: string[] = []
  const patterns = [
    /(?:今天|今日|明天|明日|后天|大后天)(?:的)?(?:\s*(?:上午|下午|晚上|中午))?\s*\d{1,2}\s*点(?:\s*\d{1,2}\s*分?|半)?/,
    /\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*(?:上午|下午|晚上|中午))?\s*\d{1,2}\s*点(?:\s*\d{1,2}\s*分?|半)?/,
    /(?:今天|今日|明天|明日|后天|大后天)(?:的)?(?!\s*\d{1,2}\s*点)/,
    /\d{1,2}\s*月\s*\d{1,2}\s*日/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const fragment = match[0]
    const day = resolveDayOffset(fragment, base)
    if (!day) continue
    const due = resolveClock(fragment, day)
    consumed.push(fragment)
    return { dueAt: toIso(due), consumed }
  }

  return { dueAt: null, consumed }
}

/** 提前 N 分钟/小时/半小时 → 相对 dueAt 回推 */
function extractRemindOffsetMinutes(text: string): { minutes: number; consumed: string | null } {
  if (/提前半小时|提早半小时/.test(text)) {
    return { minutes: 30, consumed: text.match(/提前半小时|提早半小时/)?.[0] ?? null }
  }
  const hourMatch = text.match(/提前\s*(\d+)\s*个?\s*小时/)
  if (hourMatch) {
    return { minutes: Number(hourMatch[1]) * 60, consumed: hourMatch[0] }
  }
  const minMatch = text.match(/提前\s*(\d+)\s*分钟/)
  if (minMatch) {
    return { minutes: Number(minMatch[1]), consumed: minMatch[0] }
  }
  return { minutes: 0, consumed: null }
}

/** 从「归到工作分类」或分类名直匹配 */
function extractCategory(
  text: string,
  categories: AiParseCategoryRef[]
): { category: AiParseCategoryRef | null; consumed: string[] } {
  const consumed: string[] = []
  const explicit = text.match(
    /(?:归到|分到|放入|记在)\s*[「"']?(.+?)[」"']?\s*(?:分类|里|下|类别)/
  )
  if (explicit) {
    const name = explicit[1].trim()
    const hit = categories.find((c) => c.name === name || name.includes(c.name))
    if (hit) {
      consumed.push(explicit[0])
      return { category: hit, consumed }
    }
  }

  const label = text.match(/分类\s*[：:]\s*[「"']?(.+?)[」"']?(?=[，,。；;\s]|$)/)
  if (label) {
    const name = label[1].trim()
    const hit = categories.find((c) => c.name === name || name.includes(c.name))
    if (hit) {
      consumed.push(label[0])
      return { category: hit, consumed }
    }
  }

  // 按名称长度降序，避免「工作」误匹配「工作台」子串前先匹配长名
  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)
  for (const cat of sorted) {
    if (text.includes(cat.name)) {
      consumed.push(cat.name)
      return { category: cat, consumed }
    }
  }

  return { category: null, consumed }
}

/**
 * v1 本地规则解析：从一句中文中提取标题、截止、提醒、分类。
 * 不发起网络请求；后续可替换为 LLM 而保持返回结构不变。
 */
export function parseAiTaskInput(input: string, options: AiParseOptions): AiParsedTaskDraft {
  const warnings: string[] = []
  const base = options.now ?? dayjs()
  let working = input.trim()

  if (!working) {
    return { title: '', dueAt: null, remindAt: null, category: null, warnings: ['请输入任务描述'] }
  }

  const { category, consumed: catConsumed } = extractCategory(working, options.categories)
  for (const part of catConsumed) {
    working = working.replace(part, ' ')
  }

  const { dueAt, consumed: dueConsumed } = extractDue(working, base)
  for (const part of dueConsumed) {
    working = working.replace(part, ' ')
  }

  const { minutes: remindOffset, consumed: remindConsumed } = extractRemindOffsetMinutes(working)
  if (remindConsumed) {
    working = working.replace(remindConsumed, ' ')
  }

  let remindAt: string | null = null
  if (remindOffset > 0) {
    if (dueAt) {
      remindAt = toIso(dayjs(dueAt).subtract(remindOffset, 'minute'))
    } else {
      warnings.push('已识别提醒提前量，但未识别截止时间，请补充或创建后编辑')
    }
  }

  // 去掉常见尾巴词与提醒残留片段
  working = working
    .replace(/提醒我/g, ' ')
    .replace(/记得提醒/g, ' ')
    .replace(/别忘了/g, ' ')
    .replace(/提前\s*\d+\s*(?:分钟|小时|个半小时)?/g, ' ')

  let title = cleanupTitle(working)
  if (!title) {
    // 兜底：取首句或原文前 32 字
    const fallback = input.split(/[，,。]/)[0]?.trim() || input.trim()
    title = fallback.slice(0, 32)
  }
  if (title.length > 200) {
    title = title.slice(0, 200)
    warnings.push('标题过长，已截断至 200 字')
  }

  if (!dueAt && /点|月|日|今天|明天|后天/.test(input)) {
    warnings.push('未能完全识别时间，创建后可在详情中修改')
  }

  return { title, dueAt, remindAt, category, warnings }
}

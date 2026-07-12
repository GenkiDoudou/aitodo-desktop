import type { AiParseCategoryRef } from './ai-task-parser'

/** 规范化单个关键词：trim 后非空才有效 */
export function normalizeCategoryKeyword(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > 32) return null
  return trimmed
}

/** 清单内去重，保留首次出现的写法 */
export function normalizeCategoryKeywords(raw: string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw ?? []) {
    const norm = normalizeCategoryKeyword(item)
    if (!norm) continue
    const key = norm.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(norm)
  }
  return result
}

export interface CategoryKeywordOwner {
  id: string
  name: string
  keywords: string[]
}

/** 解析 DB 中 keywords JSON；非法则返回 [] */
export function parseCategoryKeywordsJson(raw: string | null | undefined): string[] {
  if (!raw || raw === '[]') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeCategoryKeywords(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return []
  }
}

export function serializeCategoryKeywords(keywords: string[]): string {
  return JSON.stringify(normalizeCategoryKeywords(keywords))
}

/**
 * 全局关键词唯一性校验。
 * @returns 冲突描述；无冲突返回 null
 */
export function findCategoryKeywordConflict(
  keywords: string[],
  allCategories: CategoryKeywordOwner[],
  excludeCategoryId?: string
): string | null {
  const normalizedIncoming = normalizeCategoryKeywords(keywords)
  const global = new Map<string, { categoryName: string; keyword: string }>()

  for (const cat of allCategories) {
    if (excludeCategoryId && cat.id === excludeCategoryId) continue
    for (const kw of cat.keywords) {
      const norm = normalizeCategoryKeyword(kw)
      if (!norm) continue
      global.set(norm.toLowerCase(), { categoryName: cat.name, keyword: norm })
    }
  }

  for (const kw of normalizedIncoming) {
    const hit = global.get(kw.toLowerCase())
    if (hit) {
      return `关键词「${kw}」已被清单「${hit.categoryName}」使用`
    }
  }
  return null
}

interface KeywordHit {
  category: AiParseCategoryRef
  keyword: string
}

/**
 * 标题子串匹配关键词：跨清单取最长命中词，再落到对应清单。
 */
export function matchCategoryByKeywords(
  text: string,
  categories: AiParseCategoryRef[]
): AiParseCategoryRef | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  let best: KeywordHit | null = null
  for (const cat of categories) {
    for (const raw of cat.keywords ?? []) {
      const keyword = normalizeCategoryKeyword(raw)
      if (!keyword || !trimmed.includes(keyword)) continue
      if (!best || keyword.length > best.keyword.length) {
        best = { category: cat, keyword }
      }
    }
  }
  return best?.category ?? null
}

/**
 * 创建任务时的清单解析顺序：
 * 1. 标题显式/清单名匹配
 * 2. 导航默认清单
 * 3. 关键词匹配
 */
export function resolveCreateCategoryId(
  rawInput: string,
  parsedCategoryId: string | null | undefined,
  navCategoryId: string | null | undefined,
  categories: AiParseCategoryRef[]
): string | null {
  if (parsedCategoryId) return parsedCategoryId
  if (navCategoryId) return navCategoryId
  return matchCategoryByKeywords(rawInput, categories)?.id ?? null
}

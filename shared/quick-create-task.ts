import {
  buildCreateTaskDtoFromParsed,
  parseAiTaskInput,
  type AiParseCategoryRef,
  type AiParsedTaskDraft
} from './ai-task-parser'
import type { CreateTaskDto } from './types'

export function toParseCategories(
  categories: Array<{ id: string; name: string; keywords?: string[] | null }>
): AiParseCategoryRef[] {
  // 必须产出可 structuredClone 的纯对象：Vue 响应式 keywords 数组直接传入 IPC 会报
  // "An object could not be cloned."
  return categories.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    keywords: Array.isArray(c.keywords) ? c.keywords.map((k) => String(k)) : []
  }))
}

/** 将已解析 draft 组装为 CreateTaskDto（供 IPC 解析结果复用） */
export function buildQuickCreateTaskDtoFromDraft(
  draft: AiParsedTaskDraft,
  rawInput: string,
  categories: Array<{ id: string; name: string; keywords?: string[] | null }>,
  overrides?: Partial<CreateTaskDto>
): CreateTaskDto {
  const parseCategories = toParseCategories(categories)
  return buildCreateTaskDtoFromParsed(draft, overrides, {
    rawInput: rawInput.trim() || rawInput,
    parseCategories
  })
}

export function buildQuickCreateTaskDto(
  rawInput: string,
  categories: Array<{ id: string; name: string; keywords?: string[] | null }>,
  overrides?: Partial<CreateTaskDto>
): CreateTaskDto {
  const parseCategories = toParseCategories(categories)
  const trimmed = rawInput.trim()
  const parsed = parseAiTaskInput(trimmed || rawInput, { categories: parseCategories })
  return buildQuickCreateTaskDtoFromDraft(parsed, trimmed || rawInput, categories, overrides)
}

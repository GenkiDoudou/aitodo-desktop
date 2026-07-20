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
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    keywords: c.keywords ?? []
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

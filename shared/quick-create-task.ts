import {
  buildCreateTaskDtoFromParsed,
  parseAiTaskInput,
  type AiParseCategoryRef
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

export function buildQuickCreateTaskDto(
  rawInput: string,
  categories: Array<{ id: string; name: string; keywords?: string[] | null }>,
  overrides?: Partial<CreateTaskDto>
): CreateTaskDto {
  const parseCategories = toParseCategories(categories)
  const trimmed = rawInput.trim()
  const parsed = parseAiTaskInput(trimmed || rawInput, { categories: parseCategories })
  return buildCreateTaskDtoFromParsed(parsed, overrides, {
    rawInput: trimmed || rawInput,
    parseCategories
  })
}

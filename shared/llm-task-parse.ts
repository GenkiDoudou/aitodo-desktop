import type { AiParseCategoryRef, AiParsedTaskDraft } from './ai-task-parser'
import { primaryRemindAt, type TaskReminderInput } from './task-reminder'

export interface ParseTaskInputResult {
  draft: AiParsedTaskDraft
  usedLlm: boolean
  fellBackToLocal: boolean
}

/** 大模型返回的任务 JSON（与 DEFAULT_AI_SYSTEM_PROMPT 约定一致） */
export interface LlmTaskJson {
  title?: unknown
  dueAt?: unknown
  remindAt?: unknown
  categoryName?: unknown
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t || t.toLowerCase() === 'null') return null
  return t
}

function looksLikeLocalIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function normalizeLocalIso(value: string | null): string | null {
  if (!value) return null
  if (!looksLikeLocalIso(value)) return null
  return value.length === 16 ? `${value}:00` : value
}

function matchCategory(
  name: string | null,
  categories: AiParseCategoryRef[]
): AiParseCategoryRef | null {
  if (!name) return null
  const exact = categories.find((c) => c.name === name)
  if (exact) return exact
  const lower = name.toLowerCase()
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null
}

/**
 * 将大模型原始回复解析为 AiParsedTaskDraft。
 * 解析失败抛错，由调用方回落本地规则。
 */
export function draftFromLlmTaskResponse(
  rawContent: string,
  categories: AiParseCategoryRef[],
  fallbackTitle: string
): AiParsedTaskDraft {
  const jsonText = stripMarkdownFence(rawContent)
  let parsed: LlmTaskJson
  try {
    parsed = JSON.parse(jsonText) as LlmTaskJson
  } catch {
    throw new Error('大模型返回不是合法 JSON')
  }

  const title = asNullableString(parsed.title)?.slice(0, 200) || fallbackTitle.trim() || '未命名任务'
  const dueAt = normalizeLocalIso(asNullableString(parsed.dueAt))
  let remindAt = normalizeLocalIso(asNullableString(parsed.remindAt))
  if (remindAt && dueAt && remindAt > dueAt) {
    remindAt = dueAt
  }

  const category = matchCategory(asNullableString(parsed.categoryName), categories)
  const reminders: TaskReminderInput[] =
    remindAt != null ? [{ remindAt, offsetMinutes: null }] : []

  return {
    title,
    dueAt,
    remindAt: reminders.length > 0 ? primaryRemindAt(reminders) : null,
    reminders,
    recurrence: null,
    category,
    warnings: [],
    highlights: []
  }
}

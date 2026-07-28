import dayjs from 'dayjs'
import {
  parseAiTaskInput,
  type AiParseCategoryRef,
  type AiParsedTaskDraft
} from '@shared/ai-task-parser'
import { renderAiUserPrompt } from '@shared/ai-prompt-config'
import { draftFromLlmTaskResponse, type ParseTaskInputResult } from '@shared/llm-task-parse'
import { readAiPromptConfig, readLlmConfig } from '../data-path'
import { chatCompletion } from './llm-client'

export type { ParseTaskInputResult }

function parseLocal(text: string, categories: AiParseCategoryRef[]): AiParsedTaskDraft {
  return parseAiTaskInput(text, { categories })
}

/**
 * 按设置中的 taskParseMode 解析任务文本。
 * llm 模式失败（无 Key、网络、JSON）时回落本地并标记 fellBackToLocal。
 */
export async function parseTaskInputWithConfig(
  text: string,
  categories: AiParseCategoryRef[]
): Promise<ParseTaskInputResult> {
  const trimmed = text.trim()
  const promptCfg = readAiPromptConfig()
  if (promptCfg.taskParseMode !== 'llm') {
    return {
      draft: parseLocal(trimmed || text, categories),
      usedLlm: false,
      fellBackToLocal: false
    }
  }

  const llmCfg = readLlmConfig()
  if (!llmCfg.apiKey.trim()) {
    const draft = parseLocal(trimmed || text, categories)
    draft.warnings = [...draft.warnings, '未配置 API Key，已使用本地解析']
    return { draft, usedLlm: false, fellBackToLocal: true }
  }

  try {
    const categoryList = categories.map((c) => c.name).join('、') || '（无）'
    const userContent = renderAiUserPrompt(promptCfg.userTemplate, {
      input: trimmed || text,
      today: dayjs().format('YYYY-MM-DD'),
      categories: categoryList
    })
    const raw = await chatCompletion(llmCfg, promptCfg.systemPrompt, userContent)
    const draft = draftFromLlmTaskResponse(raw, categories, trimmed || text)
    return { draft, usedLlm: true, fellBackToLocal: false }
  } catch (err) {
    const draft = parseLocal(trimmed || text, categories)
    const reason = err instanceof Error ? err.message : '未知错误'
    draft.warnings = [...draft.warnings, `大模型解析失败，已回落本地：${reason}`]
    return { draft, usedLlm: false, fellBackToLocal: true }
  }
}

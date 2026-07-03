/**
 * AI 一句话建任务的提示词配置，持久化于 config.json 的 aiPrompt 字段。
 * systemPrompt 定义解析规则；userTemplate 中 {input} 为用户输入占位符。
 */
export interface AiPromptConfig {
  /** 系统提示词：指导模型如何从自然语言提取任务字段 */
  systemPrompt: string
  /** 用户消息模板，须包含 {input} 占位符 */
  userTemplate: string
}

export const DEFAULT_AI_SYSTEM_PROMPT = `你是 aiTodo 桌面待办助手的任务解析器。用户会用一句中文描述待办，你需要提取结构化字段。

请严格只输出 JSON，不要 markdown 代码块，格式如下：
{
  "title": "任务标题（必填，简短）",
  "dueAt": "yyyy-MM-ddTHH:mm:ss 或 null",
  "remindAt": "yyyy-MM-ddTHH:mm:ss 或 null",
  "categoryName": "分类名称或 null"
}

规则：
1. title 必填，从用户描述中提炼核心动作，不超过 200 字
2. 时间使用本地时间 ISO 格式（无毫秒、无时区），无法确定则 null
3. remindAt 必须早于或等于 dueAt；仅有提醒无到期时 remindAt 可为 null
4. categoryName 仅当用户明确提到分类/清单名称时填写，否则 null
5. 当前日期参考用户消息中的「今天」上下文`

export const DEFAULT_AI_USER_TEMPLATE = `今天日期：{today}

可选分类：{categories}

用户输入：
{input}`

export function getDefaultAiPromptConfig(): AiPromptConfig {
  return {
    systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
    userTemplate: DEFAULT_AI_USER_TEMPLATE
  }
}

export function mergeAiPromptConfig(partial?: Partial<AiPromptConfig> | null): AiPromptConfig {
  const defaults = getDefaultAiPromptConfig()
  if (!partial) return { ...defaults }
  return {
    systemPrompt: partial.systemPrompt?.trim() || defaults.systemPrompt,
    userTemplate: partial.userTemplate?.trim() || defaults.userTemplate
  }
}

/** 将用户模板中的占位符替换为实际内容 */
export function renderAiUserPrompt(
  template: string,
  vars: { input: string; today: string; categories: string }
): string {
  return template
    .replace(/\{input\}/g, vars.input)
    .replace(/\{today\}/g, vars.today)
    .replace(/\{categories\}/g, vars.categories)
}

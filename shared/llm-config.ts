/** 大模型服务商：v1 支持阿里通义与 DeepSeek */
export type LlmProvider = 'alibaba' | 'deepseek'

/**
 * 本地大模型配置，持久化于 data/config.json。
 * apiKey 仅存本地，不上传；供后续 AI 一句话等功能调用。
 */
export interface LlmConfig {
  /** 当前启用的服务商 */
  provider: LlmProvider
  /** API Key（设置页以密码框展示） */
  apiKey: string
  /** 模型 ID，如 qwen-plus / deepseek-chat */
  model: string
  /**
   * OpenAI 兼容 API 基址；留空则使用 provider 预设默认值。
   * 阿里默认 DashScope 兼容模式；DeepSeek 默认官方 v1 端点。
   */
  baseUrl: string
}

export interface LlmProviderPreset {
  id: LlmProvider
  label: string
  defaultModel: string
  defaultBaseUrl: string
  modelHint: string
  apiKeyHint: string
}

export const LLM_PROVIDER_PRESETS: Record<LlmProvider, LlmProviderPreset> = {
  alibaba: {
    id: 'alibaba',
    label: '阿里通义（DashScope）',
    defaultModel: 'qwen-plus',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelHint: '例如 qwen-plus、qwen-turbo',
    apiKeyHint: '在阿里云 DashScope 控制台获取 API Key'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    modelHint: '例如 deepseek-chat、deepseek-reasoner',
    apiKeyHint: '在 DeepSeek 开放平台获取 API Key'
  }
}

export function getDefaultLlmConfig(): LlmConfig {
  const preset = LLM_PROVIDER_PRESETS.alibaba
  return {
    provider: preset.id,
    apiKey: '',
    model: preset.defaultModel,
    baseUrl: preset.defaultBaseUrl
  }
}

/** 合并用户配置与默认值；切换 provider 时未填写的 model/baseUrl 回落到预设 */
export function mergeLlmConfig(partial?: Partial<LlmConfig> | null): LlmConfig {
  const defaults = getDefaultLlmConfig()
  if (!partial) return { ...defaults }
  const provider = partial.provider ?? defaults.provider
  const preset = LLM_PROVIDER_PRESETS[provider]
  return {
    provider,
    apiKey: partial.apiKey ?? '',
    model: partial.model?.trim() || preset.defaultModel,
    baseUrl: partial.baseUrl?.trim() || preset.defaultBaseUrl
  }
}

/** 解析实际请求应使用的 baseUrl */
export function resolveLlmBaseUrl(config: LlmConfig): string {
  const trimmed = config.baseUrl.trim()
  if (trimmed) return trimmed.replace(/\/$/, '')
  return LLM_PROVIDER_PRESETS[config.provider].defaultBaseUrl
}

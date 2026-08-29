import { mergeLlmConfig, resolveLlmBaseUrl, type LlmConfig } from '@shared/llm-config'

export async function chatCompletion(
  config: Partial<LlmConfig> | null | undefined,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const merged = mergeLlmConfig(config)
  if (!merged.apiKey.trim()) {
    throw new Error('未配置大模型 API Key')
  }

  const baseUrl = resolveLlmBaseUrl(merged)
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${merged.apiKey.trim()}`
    },
    body: JSON.stringify({
      model: merged.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.4
    })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`大模型请求失败 (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('大模型返回内容为空')
  }
  return content
}

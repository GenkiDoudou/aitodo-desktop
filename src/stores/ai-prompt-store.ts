import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AiPromptConfig } from '@shared/ai-prompt-config'
import { unwrapIpc } from '@/ipc/client'

export const useAiPromptStore = defineStore('aiPrompt', () => {
  const config = ref<AiPromptConfig | null>(null)
  const loaded = ref(false)

  async function load() {
    config.value = unwrapIpc(await window.api.app.getAiPrompt())
    loaded.value = true
  }

  async function save(next: AiPromptConfig) {
    config.value = unwrapIpc(await window.api.app.setAiPrompt(next))
    loaded.value = true
    return config.value
  }

  return { config, loaded, load, save }
})

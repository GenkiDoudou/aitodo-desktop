import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LlmConfig } from '@shared/llm-config'
import { unwrapIpc } from '@/ipc/client'

export const useLlmStore = defineStore('llm', () => {
  const config = ref<LlmConfig | null>(null)
  const loaded = ref(false)

  async function load() {
    config.value = unwrapIpc(await window.api.app.getLlmConfig())
    loaded.value = true
  }

  async function save(next: LlmConfig) {
    config.value = unwrapIpc(await window.api.app.setLlmConfig(next))
    loaded.value = true
    return config.value
  }

  return { config, loaded, load, save }
})

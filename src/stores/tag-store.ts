import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapIpc } from '@/ipc/client'

export const useTagStore = defineStore('tags', () => {
  const names = ref<string[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      names.value = unwrapIpc(await window.api.tags.list())
    } finally {
      loading.value = false
    }
  }

  function remember(namesToAdd: readonly string[]) {
    const set = new Set(names.value)
    for (const name of namesToAdd) {
      set.add(name)
    }
    names.value = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }

  return { names, loading, load, remember }
})

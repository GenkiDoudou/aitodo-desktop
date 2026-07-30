import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Category } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

export const useCategoryStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])

  async function load() {
    categories.value = unwrapIpc(await window.api.categories.list())
  }

  async function create(name: string, options?: { color?: string; keywords?: string[] }) {
    unwrapIpc(
      await window.api.categories.create({
        name,
        color: options?.color,
        keywords: options?.keywords
      })
    )
    await load()
  }

  async function update(
    id: string,
    patch: { name?: string; color?: string; keywords?: string[] }
  ) {
    unwrapIpc(await window.api.categories.update(id, patch))
    await load()
  }

  async function reorder(ids: string[]) {
    categories.value = unwrapIpc(await window.api.categories.reorder(ids))
  }

  async function remove(id: string) {
    unwrapIpc(await window.api.categories.delete(id))
    await load()
  }

  return { categories, load, create, update, reorder, remove }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Category } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

export const useCategoryStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])

  async function load() {
    categories.value = unwrapIpc(await window.api.categories.list())
  }

  async function create(name: string, color?: string) {
    unwrapIpc(await window.api.categories.create({ name, color }))
    await load()
  }

  async function update(id: string, name: string, color?: string) {
    unwrapIpc(await window.api.categories.update(id, { name, color }))
    await load()
  }

  async function remove(id: string) {
    unwrapIpc(await window.api.categories.delete(id))
    await load()
  }

  return { categories, load, create, update, remove }
})

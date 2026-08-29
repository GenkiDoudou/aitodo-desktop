import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CreateScheduledSummaryDto, ScheduledSummary, UpdateScheduledSummaryDto } from '@shared/types'
import { toPlainScheduledSummaryDto } from '@shared/scheduled-summary'
import { IpcUnwrapError, unwrapIpc } from '@/ipc/client'

export const useScheduledSummaryStore = defineStore('scheduledSummaries', () => {
  const items = ref<ScheduledSummary[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      items.value = unwrapIpc(await window.api.scheduledSummaries.list())
    } catch (err) {
      reportScheduledSummaryError(err, '加载汇总失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function create(dto: CreateScheduledSummaryDto) {
    try {
      const created = unwrapIpc(
        await window.api.scheduledSummaries.create(toPlainScheduledSummaryDto(dto))
      )
      items.value = [...items.value, created]
      return created
    } catch (err) {
      reportScheduledSummaryError(err, '创建汇总失败')
      throw err
    }
  }

  async function update(id: string, dto: UpdateScheduledSummaryDto) {
    try {
      const updated = unwrapIpc(
        await window.api.scheduledSummaries.update(id, toPlainScheduledSummaryDto(dto))
      )
      items.value = items.value.map((s) => (s.id === id ? updated : s))
      return updated
    } catch (err) {
      reportScheduledSummaryError(err, '更新汇总失败')
      throw err
    }
  }

  async function remove(id: string) {
    try {
      await unwrapIpc(await window.api.scheduledSummaries.delete(id))
      items.value = items.value.filter((s) => s.id !== id)
    } catch (err) {
      reportScheduledSummaryError(err, '删除汇总失败')
      throw err
    }
  }

  async function runNow(id: string) {
    try {
      const updated = unwrapIpc(await window.api.scheduledSummaries.runNow(id))
      items.value = items.value.map((s) => (s.id === id ? updated : s))
      return updated
    } catch (err) {
      reportScheduledSummaryError(err, '立即生成失败')
      throw err
    }
  }

  return { items, loading, load, create, update, remove, runNow }
})

function reportScheduledSummaryError(err: unknown, fallback: string) {
  if (err instanceof IpcUnwrapError) {
    return
  }
  if (!(err instanceof Error)) {
    ElMessage.error(fallback)
    return
  }
  const message = err.message
  if (/could not be cloned|No handler registered/i.test(message)) {
    ElMessage.error('保存失败：请完全退出应用后重新启动再试')
    return
  }
  ElMessage.error(message || fallback)
}

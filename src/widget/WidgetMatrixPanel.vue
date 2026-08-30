<template>
  <section class="matrix-panel">
    <div v-if="loading && tasks.length === 0" class="matrix-panel__empty">四象限加载中…</div>
    <div v-else-if="tasks.length === 0" class="matrix-panel__empty">暂无未完成任务</div>
    <div v-else class="matrix-panel__grid">
      <article
        v-for="meta in priorities"
        :key="meta.value"
        class="matrix-panel__quadrant"
        :style="{ '--priority-color': meta.color }"
      >
        <header class="matrix-panel__quadrant-head">
          <span class="matrix-panel__code">{{ meta.code }}</span>
          <span class="matrix-panel__title">{{ meta.quadrantTitle }}</span>
          <span class="matrix-panel__count">{{ groupedTasks[meta.value].length }}</span>
        </header>

        <div v-if="groupedTasks[meta.value].length === 0" class="matrix-panel__hint">
          空
        </div>
        <div v-else class="matrix-panel__tasks">
          <div v-for="task in groupedTasks[meta.value]" :key="task.id" class="matrix-panel__task">
            <input
              class="matrix-panel__check"
              type="checkbox"
              :disabled="updatingIds.has(task.id)"
              @change="toggleDone(task.id)"
            />
            <button type="button" class="matrix-panel__task-title" @click="openTask(task.id)">
              {{ task.title }}
            </button>
            <select
              class="matrix-panel__priority"
              :value="task.priority"
              :disabled="updatingIds.has(task.id)"
              title="调整优先级"
              @change="changePriority(task.id, $event)"
            >
              <option v-for="option in priorities" :key="option.value" :value="option.value">
                {{ option.code }}
              </option>
            </select>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { splitTasksByPriority } from '@shared/quadrant-tasks'
import { TASK_PRIORITIES, type TaskPriority } from '@shared/task-priority'
import type { Task } from '@shared/types'
import { nextTaskStatus } from '@shared/task-status-cycle'

const tasks = ref<Task[]>([])
const loading = ref(false)
const updatingIds = ref(new Set<string>())
const priorities = TASK_PRIORITIES

const groupedTasks = computed(() => splitTasksByPriority(tasks.value))

function setUpdating(id: string, updating: boolean) {
  const next = new Set(updatingIds.value)
  if (updating) next.add(id)
  else next.delete(id)
  updatingIds.value = next
}

async function reload() {
  loading.value = true
  const res = await window.widgetApi.tasks.list({ hideDone: true })
  loading.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  tasks.value = res.data
}

async function toggleDone(id: string) {
  const task = tasks.value.find((t) => t.id === id)
  if (!task) return
  const next = nextTaskStatus(task.status)
  setUpdating(id, true)
  const res = await window.widgetApi.tasks.update(id, { status: next })
  setUpdating(id, false)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await reload()
}

async function changePriority(id: string, event: Event) {
  const priority = Number((event.target as HTMLSelectElement).value) as TaskPriority
  setUpdating(id, true)
  const res = await window.widgetApi.tasks.update(id, { priority })
  setUpdating(id, false)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await reload()
}

async function openTask(taskId: string) {
  await window.widgetApi.app.openMain(`/?view=matrix&taskId=${encodeURIComponent(taskId)}`)
}

onMounted(() => {
  void reload()
})
</script>

<style scoped lang="scss">
.matrix-panel {
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.matrix-panel__grid {
  height: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.matrix-panel__quadrant {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--priority-color) 38%, var(--widget-border));
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--priority-color) 14%, transparent), transparent 48%),
    rgba(255, 255, 255, 0.035);
}

.matrix-panel__quadrant-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.matrix-panel__code {
  flex: 0 0 auto;
  color: var(--priority-color);
  font-size: 11px;
  font-weight: 700;
}

.matrix-panel__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--widget-text);
  font-size: 11px;
  font-weight: 600;
}

.matrix-panel__count {
  flex: 0 0 auto;
  min-width: 18px;
  border-radius: 999px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--widget-muted);
  font-size: 10px;
  text-align: center;
}

.matrix-panel__tasks {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.matrix-panel__task {
  display: grid;
  grid-template-columns: 15px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.13);
}

.matrix-panel__check {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--priority-color);
  cursor: pointer;
}

.matrix-panel__task-title {
  min-width: 0;
  border: none;
  padding: 0;
  overflow: hidden;
  background: transparent;
  color: var(--widget-text);
  cursor: pointer;
  font-size: 11px;
  line-height: 1.35;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matrix-panel__task-title:hover {
  color: var(--widget-accent);
}

.matrix-panel__priority {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 2px 3px;
  background: #202638;
  color: var(--widget-muted);
  font-size: 10px;
  cursor: pointer;
}

.matrix-panel__hint,
.matrix-panel__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--widget-muted);
  font-size: 12px;
}

.matrix-panel__hint {
  flex: 1;
  height: auto;
  font-size: 11px;
}
</style>

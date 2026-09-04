<template>

  <!-- 只读任务详情：遮罩 + 右侧 500px Drawer，字段与 HTML 原型对齐 -->

  <Teleport to="body">

    <div v-if="visible" class="task-drawer-overlay" @click.self="emit('close')">

      <aside class="task-drawer" @click.stop>

        <header class="task-drawer__head">

          <strong>任务详情</strong>

          <button type="button" class="task-drawer__close" aria-label="关闭" @click="emit('close')">

            ×

          </button>

        </header>



        <div v-loading="loading" class="task-drawer__body">

          <template v-if="task">

            <h3 class="task-drawer__title">{{ task.title }}</h3>



            <div class="task-drawer__row">

              <label>优先级</label>

              <span class="task-drawer__prio" :class="`is-p${task.priority}`">

                {{ priorityMeta.code }}

              </span>

            </div>

            <div class="task-drawer__row">

              <label>状态</label>

              <span>{{ statusLabel(task.status) }}</span>

            </div>

            <div class="task-drawer__row">

              <label>清单</label>

              <span>{{ categoryLabel }}</span>

            </div>

            <div class="task-drawer__row">

              <label>截止</label>

              <span>{{ task.dueAt ? formatTaskListTime(task.dueAt) : '未设置' }}</span>

            </div>

            <div class="task-drawer__row">

              <label>提醒</label>

              <span>{{ remindLabel }}</span>

            </div>



            <section class="task-drawer__section">

              <h4>标签</h4>

              <div v-if="task.tags?.length" class="task-drawer__chips">

                <span v-for="tag in task.tags" :key="tag" class="task-drawer__chip">{{ tag }}</span>

              </div>

              <span v-else class="task-drawer__muted">未设置</span>

            </section>



            <section class="task-drawer__section">

              <h4>描述</h4>

              <div v-if="task.description" class="task-drawer__markdown">{{ task.description }}</div>

              <span v-else class="task-drawer__muted">未设置</span>

            </section>



            <section v-if="childTasks.length" class="task-drawer__section">

              <h4>子任务</h4>

              <ul class="task-drawer__subtasks">

                <li v-for="child in childTasks" :key="child.id">

                  <TaskStatusCheckbox :status="child.status" @toggle="toggleChild(child)" />

                  <span :class="{ 'is-done': child.status === 'DONE' }">{{ child.title }}</span>

                </li>

              </ul>

            </section>



            <section class="task-drawer__section">

              <h4>活动</h4>

              <TaskActivityList v-if="taskId" :task-id="taskId" />

            </section>

          </template>

        </div>



        <footer class="task-drawer__foot">

          <el-button @click="emit('close')">关闭</el-button>

          <el-button type="primary" @click="emit('edit')">编辑任务</el-button>

        </footer>

      </aside>

    </div>

  </Teleport>

</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import type { Task, TaskStatus } from '@shared/types'

import { getTaskPriorityMeta } from '@shared/task-priority'

import { unwrapIpc } from '@/ipc/client'

import { useCategoryStore } from '@/stores/category-store'

import { useTaskStore } from '@/stores/task-store'

import { formatTaskListTime } from '@/utils/format-task-time'

import { nextTaskStatus } from '@shared/task-status-cycle'

import TaskActivityList from '@/components/TaskActivityList.vue'

import TaskStatusCheckbox from '@/components/TaskStatusCheckbox.vue'



const props = defineProps<{

  visible: boolean

  taskId: string | null

}>()



const emit = defineEmits<{

  close: []

  edit: []

}>()



const categoryStore = useCategoryStore()

const taskStore = useTaskStore()

const loading = ref(false)

const task = ref<Task | null>(null)

const childTasks = ref<Task[]>([])



const priorityMeta = computed(() =>

  getTaskPriorityMeta(task.value?.priority ?? 4)

)



const categoryLabel = computed(() => {

  if (!task.value?.categoryId) return '未分类'

  return (

    categoryStore.categories.find((c) => c.id === task.value?.categoryId)?.name ?? '未分类'

  )

})



const remindLabel = computed(() => {

  const reminders = task.value?.reminders ?? []

  if (reminders.length === 0) return '不提醒'

  const offset = reminders.find((r) => r.offsetMinutes != null)?.offsetMinutes

  if (offset != null) return `提前 ${offset} 分钟`

  return '已设置提醒'

})



function statusLabel(status: TaskStatus) {

  if (status === 'DONE') return '已完成'

  if (status === 'IN_PROGRESS') return '进行中'

  return '待办'

}



async function loadTask() {

  if (!props.visible || !props.taskId) {

    task.value = null

    childTasks.value = []

    return

  }

  loading.value = true

  try {

    task.value = unwrapIpc(await window.api.tasks.get(props.taskId))

    childTasks.value = unwrapIpc(

      await window.api.tasks.list({ parentId: props.taskId })

    )

  } finally {

    loading.value = false

  }

}



async function toggleChild(child: Task) {

  const next = nextTaskStatus(child.status)

  await taskStore.update(child.id, { status: next })

  await loadTask()

}



watch(

  () => [props.visible, props.taskId] as const,

  () => {

    void loadTask()

  },

  { immediate: true }

)

</script>



<style scoped lang="scss">

.task-drawer-overlay {

  position: fixed;

  inset: 0;

  background: rgba(0, 0, 0, 0.35);

  z-index: 2000;

  display: flex;

  justify-content: flex-end;

}



.task-drawer {

  width: 500px;

  max-width: 100%;

  height: 100%;

  background: #fff;

  box-shadow: -8px 0 28px rgba(0, 0, 0, 0.12);

  display: flex;

  flex-direction: column;

}



.task-drawer__head {

  height: 58px;

  flex-shrink: 0;

  display: flex;

  align-items: center;

  padding: 0 18px;

  border-bottom: 1px solid #ebeef5;



  strong {

    font-size: 16px;

  }

}



.task-drawer__close {

  margin-left: auto;

  width: 32px;

  height: 32px;

  border: none;

  background: transparent;

  border-radius: 5px;

  font-size: 20px;

  line-height: 1;

  color: #606266;

  cursor: pointer;



  &:hover {

    background: #f2f3f5;

  }

}



.task-drawer__body {

  flex: 1;

  overflow: auto;

  padding: 18px;

}



.task-drawer__title {

  margin: 0 0 15px;

  font-size: 20px;

  font-weight: 650;

}



.task-drawer__row {

  display: flex;

  align-items: center;

  padding: 10px 0;

  border-bottom: 1px solid #f2f3f5;

  font-size: 14px;



  label {

    width: 80px;

    flex-shrink: 0;

    color: #909399;

  }

}



.task-drawer__prio {

  font-weight: 650;

  font-size: 12px;



  &.is-p1 {

    color: var(--desktop-priority-p0);

  }

  &.is-p2 {

    color: var(--desktop-priority-p1);

  }

  &.is-p3 {

    color: var(--desktop-priority-p2);

  }

  &.is-p4 {

    color: var(--desktop-priority-p3);

  }

}



.task-drawer__section {

  margin-top: 20px;



  h4 {

    margin: 0 0 9px;

    font-size: 13px;

    font-weight: 600;

  }

}



.task-drawer__chips {

  display: flex;

  flex-wrap: wrap;

  gap: 6px;

}



.task-drawer__chip {

  padding: 3px 8px;

  border-radius: 3px;

  background: #ecf5ff;

  color: #409eff;

  font-size: 12px;

}



.task-drawer__muted {

  color: #a8abb2;

  font-size: 13px;

}



.task-drawer__markdown {

  white-space: pre-wrap;

  font-size: 13px;

  line-height: 1.6;

  color: var(--desktop-text-secondary);

  border: 1px solid var(--desktop-border);

  border-radius: 4px;

  padding: 10px;

  background: #fcfcfc;

}



.task-drawer__subtasks {

  list-style: none;

  margin: 0;

  padding: 0;



  li {

    display: flex;

    align-items: center;

    gap: 8px;

    height: 36px;

    border-bottom: 1px solid #f2f3f5;

    font-size: 13px;



    .is-done {

      text-decoration: line-through;

      color: #a8abb2;

    }

  }

}



.task-drawer__foot {

  height: 58px;

  flex-shrink: 0;

  display: flex;

  align-items: center;

  justify-content: flex-end;

  gap: 8px;

  padding: 0 18px;

  border-top: 1px solid #ebeef5;

}

</style>


<template>

  <div class="task-list-toolbar">

    <el-input

      ref="searchInputRef"

      :model-value="searchQuery"

      class="task-list-toolbar__search"

      placeholder="搜索任务…"

      clearable

      @update:model-value="emit('update:searchQuery', $event)"

    >

      <template #prefix>

        <el-icon><Search /></el-icon>

      </template>

    </el-input>



    <div v-if="showViewSeg" class="task-list-toolbar__seg">

      <button

        type="button"

        class="task-list-toolbar__seg-btn"

        :class="{ 'is-active': viewMode === 'list' }"

        @click="emit('update:viewMode', 'list')"

      >

        列表

      </button>

      <button

        type="button"

        class="task-list-toolbar__seg-btn"

        :class="{ 'is-active': viewMode === 'kanban' }"

        @click="emit('update:viewMode', 'kanban')"

      >

        看板

      </button>

    </div>



    <el-popover placement="bottom-end" :width="280" trigger="click">

      <template #reference>

        <button type="button" class="task-list-toolbar__btn">
          筛选
        </button>

      </template>

      <p class="task-list-toolbar__hint">在列表设置中配置视图筛选与清单范围</p>

    </el-popover>



    <el-dropdown v-if="showSortGroup" trigger="click" @command="onSortCommand">

      <button type="button" class="task-list-toolbar__btn">

        <el-icon><Sort /></el-icon>

        排序

        <el-icon class="task-list-toolbar__caret"><ArrowDown /></el-icon>

      </button>

      <template #dropdown>

        <el-dropdown-menu>

          <el-dropdown-item

            v-for="(label, key) in sortByLabels"

            :key="key"

            :command="key"

          >

            {{ label }}

          </el-dropdown-item>

        </el-dropdown-menu>

      </template>

    </el-dropdown>



    <el-dropdown v-if="showSortGroup" trigger="click" @command="onGroupCommand">

      <button type="button" class="task-list-toolbar__btn task-list-toolbar__btn--group">

        分组：{{ groupByLabels[groupBy] }}

        <el-icon class="task-list-toolbar__caret"><ArrowDown /></el-icon>

      </button>

      <template #dropdown>

        <el-dropdown-menu>

          <el-dropdown-item

            v-for="(label, key) in groupByLabels"

            :key="key"

            :command="key"

          >

            {{ label }}

          </el-dropdown-item>

        </el-dropdown-menu>

      </template>

    </el-dropdown>



    <el-button type="primary" class="task-list-toolbar__new" @click="emit('new-task')">
      + 新建任务
    </el-button>



    <slot name="extra" />

  </div>

</template>



<script setup lang="ts">

/**

 * 列表区工具栏：搜索、列表|看板切换、筛选/排序/分组、新建任务（贴 HTML 原型）。

 */

import { ref } from 'vue'

import { ArrowDown, Search, Sort } from '@element-plus/icons-vue'

import type { InputInstance } from 'element-plus'

import {

  TASK_GROUP_BY_LABELS,

  TASK_SORT_BY_LABELS,

  type TaskGroupBy,

  type TaskSortBy

} from '@shared/task-list-layout'



withDefaults(

  defineProps<{

    searchQuery?: string

    viewMode?: 'list' | 'kanban'

    showViewSeg?: boolean

    showSortGroup?: boolean

  }>(),

  {

    searchQuery: '',

    viewMode: 'list',

    showViewSeg: true,

    showSortGroup: true

  }

)



const emit = defineEmits<{

  'update:searchQuery': [string]

  'update:viewMode': ['list' | 'kanban']

  'new-task': []

}>()



const groupBy = defineModel<TaskGroupBy>('groupBy', { required: true })

const sortBy = defineModel<TaskSortBy>('sortBy', { required: true })



const searchInputRef = ref<InputInstance>()

const groupByLabels = TASK_GROUP_BY_LABELS

const sortByLabels = TASK_SORT_BY_LABELS



function onSortCommand(key: TaskSortBy) {

  sortBy.value = key

}



function onGroupCommand(key: TaskGroupBy) {

  groupBy.value = key

}



/** 供父级 Ctrl+K / 顶栏搜索图标聚焦 */

function focusSearch() {

  searchInputRef.value?.focus()

}



defineExpose({ focusSearch })

</script>



<style scoped lang="scss">

.task-list-toolbar {

  display: flex;

  align-items: center;

  gap: 8px;

  flex-shrink: 0;

  flex-wrap: wrap;

}



.task-list-toolbar__search {

  width: 210px;

  flex-shrink: 0;

}



.task-list-toolbar__seg {

  display: inline-flex;

  border: 1px solid var(--desktop-border);

  border-radius: 4px;

  overflow: hidden;

}



.task-list-toolbar__seg-btn {

  height: 30px;

  border: none;

  border-right: 1px solid var(--desktop-border);

  background: #fff;

  padding: 0 11px;

  color: #606266;

  font-size: 13px;

  cursor: pointer;



  &:last-child {

    border-right: none;

  }



  &.is-active {

    background: var(--desktop-primary-light, #ecf5ff);

    color: var(--desktop-primary, #409eff);

  }

}



.task-list-toolbar__btn {

  display: inline-flex;

  align-items: center;

  gap: 5px;

  height: 32px;

  padding: 0 12px;

  border: 1px solid var(--desktop-border);

  border-radius: 4px;

  background: var(--desktop-panel, #fff);

  color: var(--desktop-muted);

  font-size: 13px;

  cursor: pointer;



  .el-icon {

    font-size: 14px;

    color: var(--desktop-muted);

  }



  &:hover {

    border-color: #a0cfff;

    color: var(--desktop-primary);

  }



  &--group {

    min-width: 148px;

    justify-content: space-between;

  }

}



.task-list-toolbar__new {

  height: 32px;

  border-radius: 6px;

  font-size: 13px;

  border: none;

  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);

}



.task-list-toolbar__caret {

  font-size: 12px;

  color: var(--desktop-muted);

}



.task-list-toolbar__hint {

  margin: 0;

  font-size: 12px;

  color: var(--desktop-muted);

  line-height: 1.5;

}

</style>


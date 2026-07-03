<template>
  <section class="settings-section settings-section--smart-list">
    <h2 class="settings-section__title">智能清单</h2>
    <p class="settings-section__hint">
      控制任务侧栏二级菜单的显示方式。「有内容时显示」表示仅当该项下有任务（或垃圾桶有内容）时才出现。
    </p>

    <div
      v-for="(group, groupIndex) in SMART_LIST_SIDEBAR_SETTING_GROUPS"
      :key="groupIndex"
      class="smart-list-settings__card"
    >
      <div v-for="item in group.items" :key="item.id" class="smart-list-settings__row">
        <el-icon class="smart-list-settings__icon"><component :is="iconFor(item.id)" /></el-icon>
        <span class="smart-list-settings__label">{{ item.label }}</span>
        <el-dropdown trigger="click" @command="(cmd: SmartListSidebarVisibility) => onChange(item.id, cmd)">
          <button type="button" class="smart-list-settings__vis">
            <span>{{ visibilityLabel(item.id) }}</span>
            <el-icon class="smart-list-settings__vis-arrow"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in SMART_LIST_SIDEBAR_VISIBILITY_OPTIONS"
                :key="opt"
                :command="opt"
                :class="{ 'is-active-opt': sidebarStore.preferences[item.id] === opt }"
              >
                {{ SMART_LIST_SIDEBAR_VISIBILITY_LABELS[opt] }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, type Component } from 'vue'
import { ArrowDown, Calendar, CircleCheck, Clock, Delete, Files, Filter, Folder, Sunny } from '@element-plus/icons-vue'
import {
  SMART_LIST_SIDEBAR_SETTING_GROUPS,
  SMART_LIST_SIDEBAR_VISIBILITY_LABELS,
  SMART_LIST_SIDEBAR_VISIBILITY_OPTIONS,
  type SmartListSidebarItemId,
  type SmartListSidebarVisibility
} from '@shared/smart-list-sidebar'
import { useSmartListSidebarStore } from '@/stores/smart-list-sidebar-store'

const sidebarStore = useSmartListSidebarStore()

const iconMap: Record<SmartListSidebarItemId, Component> = {
  all: Files,
  today: Sunny,
  week: Calendar,
  last7days: Clock,
  uncategorized: Folder,
  filters: Filter,
  done: CircleCheck,
  trash: Delete
}

function iconFor(id: SmartListSidebarItemId) {
  return iconMap[id]
}

function visibilityLabel(id: SmartListSidebarItemId) {
  return SMART_LIST_SIDEBAR_VISIBILITY_LABELS[sidebarStore.preferences[id]]
}

function onChange(id: SmartListSidebarItemId, visibility: SmartListSidebarVisibility) {
  sidebarStore.setVisibility(id, visibility)
}

onMounted(() => {
  sidebarStore.reload()
})
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 560px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--desktop-muted);
  line-height: 1.5;
}

.smart-list-settings__card {
  background: #fff;
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.smart-list-settings__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f1f3;

  &:last-child {
    border-bottom: none;
  }
}

.smart-list-settings__icon {
  font-size: 18px;
  color: var(--desktop-muted);
  flex-shrink: 0;
}

.smart-list-settings__label {
  flex: 1;
  font-size: 14px;
  color: var(--desktop-text);
}

.smart-list-settings__vis {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--desktop-muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.smart-list-settings__vis-arrow {
  font-size: 12px;
}

:deep(.is-active-opt) {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>

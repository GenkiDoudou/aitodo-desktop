<template>
  <div class="settings-layout">
    <aside class="settings-layout__nav">
      <div class="settings-layout__nav-head">
        <el-button text class="settings-layout__back" @click="router.push('/')">← 返回</el-button>
        <h1>设置</h1>
      </div>
      <nav class="settings-layout__menu">
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="settings-layout__menu-item"
          :class="{ 'is-active': !item.route && activeSection === item.id }"
          @click="onMenuClick(item)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="settings-layout__main">
      <SettingsDataSection v-if="activeSection === 'data'" />
      <SettingsSmartListSection v-else-if="activeSection === 'smartList'" />
      <SettingsShortcutsSection v-else-if="activeSection === 'shortcuts'" />
      <SettingsLlmSection v-else-if="activeSection === 'llm'" />
      <SettingsPromptSection v-else-if="activeSection === 'prompt'" />
      <SettingsImportExportSection v-else-if="activeSection === 'importExport'" />
      <SettingsTaskActivitySection v-else-if="activeSection === 'taskActivity'" />
      <SettingsCloseBehaviorSection v-else-if="activeSection === 'closeBehavior'" />
      <SettingsWorkdaySection v-else-if="activeSection === 'workday'" />
      <SettingsWidgetSection v-else-if="activeSection === 'widget'" />
      <SettingsAboutSection v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Coin,
  Calendar,
  Cpu,
  Document,
  Folder,
  FolderOpened,
  InfoFilled,
  Key,
  List,
  Monitor,
  SwitchButton,
  Timer
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import SettingsDataSection from '@/components/settings/SettingsDataSection.vue'
import SettingsSmartListSection from '@/components/settings/SettingsSmartListSection.vue'
import SettingsShortcutsSection from '@/components/settings/SettingsShortcutsSection.vue'
import SettingsLlmSection from '@/components/settings/SettingsLlmSection.vue'
import SettingsPromptSection from '@/components/settings/SettingsPromptSection.vue'
import SettingsImportExportSection from '@/components/settings/SettingsImportExportSection.vue'
import SettingsTaskActivitySection from '@/components/settings/SettingsTaskActivitySection.vue'
import SettingsCloseBehaviorSection from '@/components/settings/SettingsCloseBehaviorSection.vue'
import SettingsWorkdaySection from '@/components/settings/SettingsWorkdaySection.vue'
import SettingsWidgetSection from '@/components/settings/SettingsWidgetSection.vue'
import SettingsAboutSection from '@/components/settings/SettingsAboutSection.vue'

type SettingsSection =
  | 'data'
  | 'smartList'
  | 'shortcuts'
  | 'llm'
  | 'prompt'
  | 'importExport'
  | 'taskActivity'
  | 'closeBehavior'
  | 'workday'
  | 'widget'
  | 'about'

const router = useRouter()
const route = useRoute()
const activeSection = ref<SettingsSection>('data')

watch(
  () => route.query.section,
  (section) => {
    if (
      section === 'data' ||
      section === 'smartList' ||
      section === 'shortcuts' ||
      section === 'llm' ||
      section === 'prompt' ||
      section === 'importExport' ||
      section === 'taskActivity' ||
      section === 'closeBehavior' ||
      section === 'workday' ||
      section === 'widget' ||
      section === 'about'
    ) {
      activeSection.value = section
    } else if (section === 'summary' || section === 'kanban' || section === 'viewTemplates') {
      // 定时汇总已迁至左侧一级菜单；看板/视图模板设置已移除
      activeSection.value = 'data'
    }
  },
  { immediate: true }
)

type MenuItem = {
  id: SettingsSection | 'desktopOrganize'
  label: string
  icon: Component
  route?: string
}

const menuItems: MenuItem[] = [
  { id: 'data', label: '数据存储', icon: Coin },
  { id: 'smartList', label: '智能清单', icon: List },
  { id: 'shortcuts', label: '快捷键', icon: Key },
  { id: 'llm', label: '大模型', icon: Cpu },
  { id: 'prompt', label: '提示词', icon: Document },
  { id: 'importExport', label: '导入导出', icon: FolderOpened },
  { id: 'taskActivity', label: '任务动态', icon: Timer },
  { id: 'closeBehavior', label: '关闭行为', icon: SwitchButton },
  { id: 'workday', label: '工作日', icon: Calendar },
  { id: 'widget', label: '桌面挂件', icon: Monitor },
  { id: 'desktopOrganize', label: '桌面整理', icon: Folder, route: '/desktop-organize' },
  { id: 'about', label: '关于', icon: InfoFilled }
]

function onMenuClick(item: MenuItem) {
  if (item.route) {
    void router.push(item.route)
    return
  }
  activeSection.value = item.id as SettingsSection
}
</script>

<style scoped lang="scss">
.settings-layout {
  display: flex;
  height: 100vh;
  background: var(--desktop-bg);
}

.settings-layout__nav {
  width: 220px;
  flex-shrink: 0;
  background: var(--desktop-panel);
  border-right: 1px solid var(--desktop-border);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
}

.settings-layout__nav-head {
  padding: 0 8px 16px;

  h1 {
    margin: 8px 0 0;
    font-size: 20px;
    font-weight: 700;
  }
}

.settings-layout__back {
  padding-left: 0;
  color: var(--desktop-muted);
}

.settings-layout__menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-layout__menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: var(--desktop-text);

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-active {
    background: var(--desktop-active);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.settings-layout__main {
  flex: 1;
  overflow: auto;
  padding: 24px 32px;
}
</style>

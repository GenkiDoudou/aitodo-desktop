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
          :class="{ 'is-active': activeSection === item.id }"
          @click="activeSection = item.id"
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
      <SettingsSummarySection v-else-if="activeSection === 'summary'" />
      <SettingsImportExportSection v-else-if="activeSection === 'importExport'" />
      <SettingsAboutSection v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Coin, Cpu, Document, FolderOpened, InfoFilled, Key, List, Timer } from '@element-plus/icons-vue'
import SettingsDataSection from '@/components/settings/SettingsDataSection.vue'
import SettingsSmartListSection from '@/components/settings/SettingsSmartListSection.vue'
import SettingsShortcutsSection from '@/components/settings/SettingsShortcutsSection.vue'
import SettingsLlmSection from '@/components/settings/SettingsLlmSection.vue'
import SettingsPromptSection from '@/components/settings/SettingsPromptSection.vue'
import SettingsSummarySection from '@/components/settings/SettingsSummarySection.vue'
import SettingsImportExportSection from '@/components/settings/SettingsImportExportSection.vue'
import SettingsAboutSection from '@/components/settings/SettingsAboutSection.vue'

type SettingsSection = 'data' | 'smartList' | 'shortcuts' | 'llm' | 'prompt' | 'summary' | 'importExport' | 'about'

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
      section === 'summary' ||
      section === 'importExport' ||
      section === 'about'
    ) {
      activeSection.value = section
    }
  },
  { immediate: true }
)

const menuItems = [
  { id: 'data' as const, label: '数据存储', icon: Coin },
  { id: 'smartList' as const, label: '智能清单', icon: List },
  { id: 'shortcuts' as const, label: '快捷键', icon: Key },
  { id: 'llm' as const, label: '大模型', icon: Cpu },
  { id: 'prompt' as const, label: '提示词', icon: Document },
  { id: 'summary' as const, label: '定时汇总', icon: Timer },
  { id: 'importExport' as const, label: '导入导出', icon: FolderOpened },
  { id: 'about' as const, label: '关于', icon: InfoFilled }
]
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

<template>
  <AppShell>
    <template #sidebar>
      <AppSidebar
        :task-counts="sidebarTaskCounts"
        :category-counts="sidebarListCounts.byId"
        :uncategorized-count="sidebarListCounts.uncategorized"
        :done-count="taskStore.doneCount"
        @select-smart="goHomeSmartAll"
        @select-inbox="goHomeInbox"
        @select-done="goHomeDone"
        @select-kanban="goHomeKanban"
        @select-calendar="goHomeCalendar"
        @select-matrix="goHomeMatrix"
        @select-summary="goHomeSummary"
        @select-category="goHomeCategory"
        @select-tasks="goHomeTasks"
      />
    </template>

    <template #topbar>
      <AppTopBar title="设置" />
    </template>

    <div class="settings-page">
      <div class="settings-page__layout">
        <nav class="settings-page__nav" aria-label="设置分类">
          <div v-for="group in navGroups" :key="group.title" class="settings-page__nav-group">
            <p class="settings-page__nav-cat">{{ group.title }}</p>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="settings-page__nav-item"
              :class="{ 'is-active': activeSection === item.id }"
              @click="onMenuClick(item)"
            >
              {{ item.label }}
            </button>
          </div>
        </nav>

        <main class="settings-page__content">
          <h1 class="settings-page__title">{{ pageMeta.title }}</h1>
          <p class="settings-page__desc">{{ pageMeta.desc }}</p>

          <SettingsDataSection v-if="activeSection === 'data'" />
          <SettingsSyncSection v-else-if="activeSection === 'sync'" />
          <SettingsNotificationSection v-else-if="activeSection === 'notifications'" />
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
    </div>
  </AppShell>
</template>

<script setup lang="ts">
/**
 * 设置中心：嵌入 AppShell；内层分组 nav（纯文字）+ panel 内容区，贴 preview.html。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopBar from '@/components/AppTopBar.vue'
import SettingsDataSection from '@/components/settings/SettingsDataSection.vue'
import SettingsSyncSection from '@/components/settings/SettingsSyncSection.vue'
import SettingsNotificationSection from '@/components/settings/SettingsNotificationSection.vue'
import SettingsShortcutsSection from '@/components/settings/SettingsShortcutsSection.vue'
import SettingsLlmSection from '@/components/settings/SettingsLlmSection.vue'
import SettingsPromptSection from '@/components/settings/SettingsPromptSection.vue'
import SettingsImportExportSection from '@/components/settings/SettingsImportExportSection.vue'
import SettingsTaskActivitySection from '@/components/settings/SettingsTaskActivitySection.vue'
import SettingsCloseBehaviorSection from '@/components/settings/SettingsCloseBehaviorSection.vue'
import SettingsWorkdaySection from '@/components/settings/SettingsWorkdaySection.vue'
import SettingsWidgetSection from '@/components/settings/SettingsWidgetSection.vue'
import SettingsAboutSection from '@/components/settings/SettingsAboutSection.vue'
import { useTaskStore } from '@/stores/task-store'

type SettingsSection =
  | 'data'
  | 'sync'
  | 'notifications'
  | 'shortcuts'
  | 'llm'
  | 'prompt'
  | 'importExport'
  | 'taskActivity'
  | 'closeBehavior'
  | 'workday'
  | 'widget'
  | 'about'

type MenuItem = {
  id: SettingsSection
  label: string
}

type NavGroup = {
  title: string
  items: MenuItem[]
}

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const activeSection = ref<SettingsSection>('data')

const sidebarTaskCounts = computed(() => ({
  all: taskStore.tasks.filter((t) => !t.parentId && !t.deletedAt).length
}))

/** 侧栏清单计数 */
const sidebarListCounts = computed(() => {
  const roots = taskStore.tasks.filter((t) => !t.parentId && !t.deletedAt)
  const byId: Record<string, number> = {}
  let uncategorized = 0
  for (const t of roots) {
    if (!t.categoryId) uncategorized++
    else byId[t.categoryId] = (byId[t.categoryId] ?? 0) + 1
  }
  return { byId, uncategorized }
})

/** 对齐 preview.html 分组；风格切换保留在系统分组末尾 */
const navGroups: NavGroup[] = [
  {
    title: '偏好设置',
    items: [
      { id: 'data', label: '数据存储' },
      { id: 'sync', label: '账号与同步' },
      { id: 'notifications', label: '通知管理' },
      { id: 'shortcuts', label: '快捷键' },
      { id: 'closeBehavior', label: '窗口与启动' }
    ]
  },
  {
    title: '智能助手',
    items: [
      { id: 'llm', label: '大模型' },
      { id: 'prompt', label: '提示词' }
    ]
  },
  {
    title: '效率工具',
    items: [
      { id: 'workday', label: '工作日' },
      { id: 'taskActivity', label: '任务动态' },
      { id: 'widget', label: '桌面挂件' }
    ]
  },
  {
    title: '数据管理',
    items: [{ id: 'importExport', label: '导入导出' }]
  },
  {
    title: '系统',
    items: [{ id: 'about', label: '关于' }]
  }
]

const PAGE_META: Record<SettingsSection, { title: string; desc: string }> = {
  data: { title: '数据存储', desc: '管理任务数据库、附件、缓存和本地数据。' },
  sync: { title: '账号与同步', desc: '登录账号后，在多个设备之间同步任务和设置。' },
  notifications: { title: '通知管理', desc: '统一管理任务提醒、系统通知和免打扰时间。' },
  shortcuts: { title: '快捷键', desc: '自定义常用操作。全局快捷键可在应用不在前台时生效。' },
  llm: { title: '大模型', desc: '配置 Todo AI 使用的模型服务。API Key 仅保存在本机配置中。' },
  prompt: { title: '提示词', desc: '管理 AI 助手使用的系统提示词与模板。' },
  importExport: { title: '导入导出', desc: '迁移数据前建议先创建备份。导入时会保留原数据并执行冲突检测。' },
  taskActivity: { title: '任务动态', desc: '记录任务的重要变化。' },
  closeBehavior: { title: '窗口与启动', desc: '控制应用启动方式、窗口行为和系统托盘。' },
  workday: { title: '工作日', desc: '用于截止日期、重复任务和智能提醒。' },
  widget: { title: '桌面挂件', desc: '在桌面快速查看和管理任务。' },
  about: { title: '关于', desc: '小柒todo 桌面任务管理应用。' }
}

const pageMeta = computed(() => PAGE_META[activeSection.value])

watch(
  () => route.query.section,
  (section) => {
    if (
      section === 'data' ||
      section === 'sync' ||
      section === 'notifications' ||
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
    } else if (
      section === 'summary' ||
      section === 'kanban' ||
      section === 'viewTemplates' ||
      section === 'theme'
    ) {
      activeSection.value = 'data'
    }
  },
  { immediate: true }
)

function onMenuClick(item: MenuItem) {
  activeSection.value = item.id
  void router.replace({ path: '/settings', query: { section: item.id } })
}

function goHomeSmartAll() {
  void router.push({ path: '/', query: { smart: 'all' } })
}

function goHomeInbox() {
  void router.push({ path: '/', query: { view: 'inbox' } })
}

function goHomeDone() {
  void router.push({ path: '/', query: { view: 'done' } })
}

function goHomeKanban() {
  void router.push({ path: '/', query: { listView: 'kanban' } })
}

function goHomeCalendar() {
  void router.push('/calendar')
}

function goHomeMatrix() {
  void router.push({ path: '/', query: { view: 'matrix' } })
}

function goHomeSummary(section: 'config' | 'results' = 'config') {
  void router.push({ path: '/', query: { view: 'summary', section } })
}

function goHomeTasks() {
  void router.push('/')
}

/** 从设置侧栏跳转首页并筛选清单 */
function goHomeCategory(id: string | null) {
  void router.push({
    path: '/',
    query: { category: id === null ? 'uncategorized' : id }
  })
}

onMounted(async () => {
  await taskStore.load({ smartList: 'all', hideDone: false })
  await taskStore.refreshSidebarCounts()
})
</script>

<style scoped lang="scss">
.settings-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 28px;
  background: #fff;
}

.settings-page__layout {
  display: flex;
  gap: 34px;
  max-width: 1060px;
}

.settings-page__nav {
  width: 190px;
  flex: 0 0 190px;
}

.settings-page__nav-cat {
  margin: 17px 10px 6px;
  font-size: 11px;
  color: #a8abb2;

  .settings-page__nav-group:first-child & {
    margin-top: 0;
  }
}

.settings-page__nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  margin-bottom: 2px;
  padding: 0 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: #606266;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;
  }

  &.is-active {
    background: #ecf5ff;
    color: #409eff;
    font-weight: 600;
  }
}

.settings-page__content {
  width: 760px;
  min-width: 0;
  flex: 1;
}

.settings-page__title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 650;
  color: var(--desktop-text);
}

.settings-page__desc {
  margin: 0 0 18px;
  font-size: 12px;
  color: #909399;
}

/* 隐藏各 section 自带重复大标题，统一用 page 标题 */
.settings-page__content :deep(.settings-section__title) {
  display: none;
}

.settings-page__content :deep(.settings-section > .settings-section__hint:first-of-type) {
  display: none;
}

.settings-page__content :deep(.settings-panel) {
  border: 1px solid #ebeef5;
  border-radius: 7px;
  background: #fff;
  margin-bottom: 16px;
  overflow: hidden;
}

.settings-page__content :deep(.settings-panel__title) {
  padding: 16px 18px 10px;
  font-size: 14px;
  font-weight: 650;
  border-bottom: none;
}

.settings-page__content :deep(.settings-panel__body) {
  padding: 0;
}

.settings-page__content :deep(.settings-row) {
  min-height: 58px;
  padding: 11px 18px;
  border-top: 1px solid #f2f3f5;
  gap: 16px;
}

.settings-page__content :deep(.settings-panel.danger-zone) {
  border-color: #fbc4c4;
}

.settings-page__content :deep(.settings-panel.danger-zone .settings-panel__title) {
  color: #f56c6c;
}
</style>

<template>
  <div class="desk-org">
    <div
      class="desk-org__bg"
      :class="{ 'has-wallpaper': !!wallpaperPreview }"
      :style="wallpaperBgStyle"
      aria-hidden="true"
    />

    <!-- 顶栏 -->
    <header class="desk-org__top glass">
      <div class="desk-org__top-left">
        <button type="button" class="desk-org__icon-btn" title="返回" @click="router.push('/')">←</button>
        <div>
          <h1>桌面整理</h1>
          <p v-if="desktopPath" class="desk-org__sub">
            {{ desktopPath }}
            <button type="button" class="desk-org__link" @click="openDesktop">打开桌面</button>
          </p>
        </div>
      </div>
      <div class="desk-org__top-actions">
        <span v-if="plan" class="desk-org__stat">
          <template v-if="plan.moves.length > 0">待移动 {{ plan.moves.length }} / {{ plan.items.length }}</template>
          <template v-else>暂无可移动项</template>
        </span>
        <button type="button" class="desk-org__pill desk-org__pill--scan" :disabled="scanning" @click="runScan">
          {{ scanning ? '扫描中…' : '扫描桌面' }}
        </button>
        <button
          type="button"
          class="desk-org__pill desk-org__pill--organize"
          :class="{ 'is-ready': !!plan && plan.moves.length > 0 }"
          :disabled="executing"
          @click="onOrganizeClick"
        >
          {{ executing ? '整理中…' : '整理到文件夹' }}
        </button>
        <button type="button" class="desk-org__icon-btn" title="撤销" :disabled="!canUndo || undoing" @click="runUndo">
          ↩
        </button>
        <button
          type="button"
          class="desk-org__pill desk-org__pill--fence"
          :class="{ 'is-active': fenceEnabled }"
          @click="toggleDesktopFences"
        >
          {{ fenceEnabled ? '收起桌面容器' : '显示桌面容器' }}
        </button>
        <button type="button" class="desk-org__icon-btn" title="设置" @click="settingsOpen = true">⚙</button>
      </div>
    </header>

    <!-- 子页面导航 -->
    <nav class="desk-org__pages glass">
      <button
        type="button"
        class="desk-org__page"
        :class="{ 'is-active': page === 'organize' }"
        @click="page = 'organize'"
      >
        整理
      </button>
      <button
        type="button"
        class="desk-org__page"
        :class="{ 'is-active': page === 'rules' }"
        @click="page = 'rules'"
      >
        整理规则
      </button>
      <button
        type="button"
        class="desk-org__page"
        :class="{ 'is-active': page === 'wallpaper' }"
        @click="page = 'wallpaper'"
      >
        壁纸中心
      </button>
    </nav>

    <!-- 分类标签（类似截图底部 Tab） -->
    <nav v-if="page === 'organize'" class="desk-org__tabs glass">
      <button
        type="button"
        class="desk-org__tab"
        :class="{ 'is-active': activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        全部
      </button>
      <button
        v-for="cat in tabCategories"
        :key="cat.id"
        type="button"
        class="desk-org__tab"
        :class="{ 'is-active': activeTab === cat.id }"
        @click="activeTab = cat.id"
      >
        {{ cat.icon }} {{ cat.name }}
        <span v-if="countForCategory(cat.id)" class="desk-org__tab-badge">{{ countForCategory(cat.id) }}</span>
      </button>
      <button type="button" class="desk-org__tab desk-org__tab--add" @click="openCreate">+ 分类</button>
    </nav>

    <DesktopOrganizeRulesPanel v-if="page === 'rules'" class="desk-org__subpage" :categories="categories" />

    <DesktopWallpaperCenter v-else-if="page === 'wallpaper'" ref="wallpaperCenterRef" class="desk-org__subpage" />

    <!-- 主区域：毛玻璃分类容器网格 -->
    <div v-else class="desk-org__canvas">
      <template v-if="!plan">
        <div class="desk-org__empty glass">
          <p class="desk-org__empty-title">将桌面散落文件整理进分类文件夹</p>
          <p class="desk-org__empty-desc">扫描后在此预览；确认后物理移动到 {{ settings.folderPrefix }}分类名/</p>
          <div class="desk-org__empty-actions">
            <button type="button" class="desk-org__big-btn desk-org__big-btn--primary" @click="runScan">
              扫描桌面
            </button>
            <button type="button" class="desk-org__big-btn" @click="page = 'rules'">设置整理规则</button>
          </div>
        </div>
      </template>

      <div v-else class="desk-org__fences">
        <section
          v-for="cat in fenceCategories"
          :key="cat.id"
          class="desk-org__fence glass"
          @dragover.prevent
          @drop="onDropToCategory(cat.id)"
        >
          <header class="desk-org__fence-head">
            <span class="desk-org__fence-icon">{{ cat.icon }}</span>
            <span class="desk-org__fence-title">{{ cat.name }}</span>
            <span class="desk-org__fence-path">{{ settings.folderPrefix }}{{ cat.targetFolderName }}/</span>
            <span class="desk-org__fence-count">{{ itemsForCategory(cat.id).length }}</span>
            <div class="desk-org__fence-tools">
              <button
                v-if="!cat.isSystem"
                type="button"
                class="desk-org__icon-btn desk-org__icon-btn--sm"
                title="编辑规则"
                @click="openEdit(cat)"
              >
                ✎
              </button>
              <el-switch
                v-if="cat.id !== 'uncategorized'"
                :model-value="cat.enabled"
                size="small"
                @change="(v: boolean) => toggleCategory(cat, v)"
              />
            </div>
          </header>

          <div v-if="itemsForCategory(cat.id).length" class="desk-org__grid">
            <div
              v-for="item in itemsForCategory(cat.id)"
              :key="item.absolutePath"
              class="desk-org__grid-item"
              draggable="true"
              :title="targetPath(item)"
              @dragstart="onItemDragStart(item.absolutePath)"
            >
              <span class="desk-org__grid-icon">{{ itemIcon(item) }}</span>
              <span class="desk-org__grid-name">{{ item.name }}</span>
            </div>
          </div>
          <p v-else class="desk-org__fence-empty">拖入文件或等待扫描匹配</p>
        </section>
      </div>

      <div v-if="lastResult" class="desk-org__result glass">
        <span v-if="lastResult.moved.length">已移动 {{ lastResult.moved.length }} 项</span>
        <span v-for="s in lastResult.skipped" :key="s.path" class="desk-org__warn">{{ s.reason }}</span>
      </div>
    </div>

    <DesktopCategoryEditDialog
      v-model="editOpen"
      :category="editingCategory"
      :folder-prefix="settings.folderPrefix"
      @save="onCategorySave"
    />

    <el-drawer v-model="settingsOpen" title="整理设置" size="360px" direction="rtl">
      <el-form label-position="top">
        <el-form-item label="文件夹前缀">
          <el-input v-model="settingsDraft.folderPrefix" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="扫描后自动整理">
          <el-switch v-model="settingsDraft.autoOrganizeOnScan" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="启动时自动整理">
          <el-switch v-model="settingsDraft.autoOrganizeOnBoot" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="桌面出现新图标时立即整理">
          <el-switch v-model="settingsDraft.autoOrganizeOnNewIcons" @change="saveSettings" />
        </el-form-item>
        <el-form-item label="当前桌面路径">
          <el-input :model-value="desktopPath" readonly />
        </el-form-item>
        <el-button link type="primary" @click="goRulesPage">管理整理规则 →</el-button>
        <el-button link type="primary" @click="goWallpaperPage">打开壁纸中心 →</el-button>
        <el-divider content-position="left">桌面容器</el-divider>
        <el-form-item label="隐藏 Windows 原生桌面图标">
          <el-switch v-model="fenceDraft.hideNativeIcons" @change="saveFenceSettings" />
        </el-form-item>
        <p class="desk-org__drawer-hint">
          容器展示分类文件夹内的真实文件。隐藏原生图标会改写 Windows 注册表并重启资源管理器。
          若同时安装了「小智桌面」等桌面美化软件，它们也会隐藏原生图标，收起容器后可能看起来桌面一片空白——请用下方紧急恢复，或先退出该类软件。
        </p>
        <el-button type="warning" plain @click="recoverDesktopIcons">恢复桌面图标（紧急）</el-button>

      </el-form>
      <div class="desk-org__drawer-actions">
        <el-button type="primary" @click="openCreate">新建分类</el-button>
        <el-button @click="runScan">重新扫描</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import DesktopCategoryEditDialog from '@/components/DesktopCategoryEditDialog.vue'
import DesktopOrganizeRulesPanel from '@/components/DesktopOrganizeRulesPanel.vue'
import DesktopWallpaperCenter from '@/components/DesktopWallpaperCenter.vue'
import type {
  DesktopCategory,
  DesktopOrganizeExecuteResult,
  DesktopOrganizePlan,
  DesktopOrganizeSettings,
  DesktopScanItem
} from '@shared/desktop-organize-types'

const router = useRouter()
const api = window.api.desktopOrganize

const categories = ref<DesktopCategory[]>([])
const settings = ref<DesktopOrganizeSettings>({
  folderPrefix: '小柒整理-',
  layoutMode: 'flat_prefix',
  autoOrganizeOnScan: false,
  autoScanOnBoot: true,
  autoOrganizeOnBoot: false,
  autoOrganizeOnNewIcons: false,
  updatedAt: ''
})
const settingsDraft = ref({
  folderPrefix: '小柒整理-',
  autoOrganizeOnScan: false,
  autoOrganizeOnBoot: false,
  autoOrganizeOnNewIcons: false
})
const page = ref<'organize' | 'rules' | 'wallpaper'>('organize')
const wallpaperCenterRef = ref<InstanceType<typeof DesktopWallpaperCenter> | null>(null)
const plan = ref<DesktopOrganizePlan | null>(null)
const scannedItems = ref<DesktopScanItem[]>([])
const activeTab = ref<string>('all')
const canUndo = ref(false)
const scanning = ref(false)
const executing = ref(false)
const undoing = ref(false)
const editOpen = ref(false)
const settingsOpen = ref(false)
const editingCategory = ref<DesktopCategory | null>(null)
const lastResult = ref<DesktopOrganizeExecuteResult | null>(null)
const dragItemPath = ref<string | null>(null)
const desktopPath = ref('')
const fenceEnabled = ref(false)
const fenceDraft = ref({ hideNativeIcons: false })
const wallpaperPreview = ref<string | null>(null)

const wallpaperBgStyle = computed(() => {
  if (!wallpaperPreview.value) return undefined
  return {
    backgroundImage: `linear-gradient(180deg, rgba(8, 20, 28, 0.32) 0%, rgba(8, 20, 28, 0.52) 100%), url(${wallpaperPreview.value})`
  }
})

const tabCategories = computed(() =>
  categories.value.filter((c) => c.id !== 'uncategorized')
)

const fenceCategories = computed(() => {
  const base =
    activeTab.value === 'all'
      ? categories.value.filter((c) => c.enabled)
      : categories.value.filter((c) => c.id === activeTab.value)
  return base.sort((a, b) => a.sortOrder - b.sortOrder)
})

const moveTargetMap = computed(() => {
  if (!plan.value) return new Map<string, string>()
  return new Map(plan.value.moves.map((m) => [m.from, m.to]))
})

onMounted(() => {
  void loadAll()
})

watch(page, (p, prev) => {
  if (prev === 'wallpaper') void loadWallpaper()
})

async function loadDesktopPath() {
  const res = await api.getDesktopPath()
  if (res.ok) desktopPath.value = res.data
}

async function openDesktop() {
  const res = await api.openDesktop()
  if (!res.ok) ElMessage.error(res.error.message)
}

async function loadAll() {
  await Promise.all([
    loadCategories(),
    loadSettings(),
    refreshCanUndo(),
    loadDesktopPath(),
    loadFenceSettings(),
    loadWallpaper()
  ])
}

async function loadWallpaper() {
  const res = await window.api.fence.getWallpaper()
  if (!res.ok) return
  wallpaperPreview.value = res.data.previewDataUrl
}

function goRulesPage() {
  settingsOpen.value = false
  page.value = 'rules'
}

function goWallpaperPage() {
  settingsOpen.value = false
  page.value = 'wallpaper'
}

async function loadFenceSettings() {
  const res = await window.api.fence.getSettings()
  if (res.ok) {
    fenceEnabled.value = res.data.fencesEnabled
    fenceDraft.value.hideNativeIcons = res.data.hideNativeIcons
  }
}

async function saveFenceSettings() {
  const res = await window.api.fence.updateSettings({
    hideNativeIcons: fenceDraft.value.hideNativeIcons
  })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  if (fenceEnabled.value) {
    ElMessage.success(
      fenceDraft.value.hideNativeIcons
        ? '将在容器显示后隐藏原生桌面图标'
        : '已恢复原生桌面图标'
    )
  }
}

async function recoverDesktopIcons() {
  const res = await window.api.fence.recoverDesktopIcons()
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  fenceDraft.value.hideNativeIcons = false
  fenceEnabled.value = false
  ElMessage.success(
    '已强制恢复 Windows 桌面图标。若仍空白，请退出「小智桌面」等桌面美化软件后再试。'
  )
}

async function enableDesktopFences(forceShow = true) {
  const res = await window.api.fence.updateSettings({ fencesEnabled: true })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return false
  }
  fenceEnabled.value = true
  if (forceShow) {
    const showRes = await window.api.fence.showAll()
    if (!showRes.ok) {
      ElMessage.error(showRes.error.message)
      return false
    }
  }
  return true
}

async function promptShowDesktopFencesAfterScan() {
  if (fenceEnabled.value) {
    await window.api.fence.showAll()
    return
  }
  try {
    await ElMessageBox.confirm(
      '是否在桌面上显示分类容器？\n\n容器会展示各分类文件夹内的真实文件/快捷方式（不是文件夹本身），并尽量贴附在桌面壁纸层。',
      '显示桌面容器',
      { confirmButtonText: '显示', cancelButtonText: '稍后', type: 'info' }
    )
    const ok = await enableDesktopFences(true)
    if (ok) ElMessage.success('桌面容器已显示，请查看壁纸上的分类框（内含真实文件图标）')
  } catch {
    /* 用户取消 */
  }
}

async function toggleDesktopFences() {
  const next = !fenceEnabled.value
  if (next) {
    const ok = await enableDesktopFences(true)
    if (ok) {
      if (!plan.value) await runScan()
      ElMessage.success('已在桌面显示分类容器')
    }
    return
  }
  const res = await window.api.fence.updateSettings({ fencesEnabled: false })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  fenceEnabled.value = false
  // updateSettings(false) 已销毁容器并恢复原生桌面图标，无需再 hideAll（避免二次重启 Explorer）
  ElMessage.info('已收起桌面容器，桌面图标应已恢复显示')
}

async function loadCategories() {
  const res = await api.listCategories()
  if (res.ok) categories.value = res.data
}

async function loadSettings() {
  const res = await api.getSettings()
  if (res.ok) {
    settings.value = res.data
    settingsDraft.value = {
      folderPrefix: res.data.folderPrefix,
      autoOrganizeOnScan: res.data.autoOrganizeOnScan,
      autoOrganizeOnBoot: res.data.autoOrganizeOnBoot,
      autoOrganizeOnNewIcons: res.data.autoOrganizeOnNewIcons
    }
  }
}

async function refreshCanUndo() {
  const res = await api.canUndo()
  if (res.ok) canUndo.value = res.data
}

function itemsForCategory(catId: string) {
  return scannedItems.value.filter((i) => i.matchedCategoryId === catId)
}

function countForCategory(id: string) {
  return itemsForCategory(id).length
}

function targetPath(item: DesktopScanItem) {
  return moveTargetMap.value.get(item.absolutePath) ?? '—'
}

function itemIcon(item: DesktopScanItem): string {
  if (item.kind === 'folder') return '📁'
  if (item.kind === 'icon') return '🔗'
  const ext = item.name.includes('.') ? item.name.split('.').pop()!.toLowerCase() : ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return '🖼️'
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return '🎬'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return '📄'
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(ext)) return '📦'
  if (['exe', 'msi'].includes(ext)) return '⚙️'
  return '📄'
}

async function runScan() {
  scanning.value = true
  lastResult.value = null
  try {
    const scanRes = await api.scan()
    if (!scanRes.ok) {
      ElMessage.error(scanRes.error.message)
      return
    }
    scannedItems.value = scanRes.data
    const previewRes = await api.preview()
    if (!previewRes.ok) {
      ElMessage.error(previewRes.error.message)
      return
    }
    plan.value = previewRes.data
    if (previewRes.data.moves.length > 0) {
      ElMessage.info(`预览就绪：${previewRes.data.moves.length} 项待移动`)
    } else {
      ElMessage.warning('没有可移动项')
    }
    if (settings.value.autoOrganizeOnScan && previewRes.data.moves.length > 0) {
      await runOrganize(true)
    }
    await promptShowDesktopFencesAfterScan()
  } finally {
    scanning.value = false
  }
}

async function onOrganizeClick() {
  if (executing.value || scanning.value) return
  if (!plan.value) {
    ElMessage.warning('请先扫描桌面')
    return
  }
  if (plan.value.moves.length === 0) {
    ElMessage.warning('没有可移动项，请检查分类规则或拖入未分类项')
    return
  }
  await runOrganize()
}

async function runOrganize(silent = false) {
  if (!silent && (!plan.value || plan.value.moves.length === 0)) {
    ElMessage.warning('没有可移动项')
    return
  }
  if (!silent) {
    try {
      await ElMessageBox.confirm(
        `将把 ${plan.value!.moves.length} 个桌面项移动到分类文件夹，是否继续？`,
        '确认整理',
        {
          type: 'warning',
          confirmButtonText: '确定整理',
          cancelButtonText: '取消',
          closeOnClickModal: false,
          autofocus: true
        }
      )
    } catch {
      ElMessage.info('已取消整理')
      return
    }
  }
  executing.value = true
  try {
    const res = await api.execute()
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
    lastResult.value = res.data
    if (res.data.moved.length === 0) {
      ElMessage.warning('未能移动任何文件')
      return
    }
    ElMessage.success(`已移动 ${res.data.moved.length} 项`)
    await api.openDesktop()
    if (res.data.skipped.length) {
      ElMessage.warning(`${res.data.skipped.length} 项跳过`)
    }
    await refreshCanUndo()
    await runScan()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '整理失败')
  } finally {
    executing.value = false
  }
}

async function runUndo() {
  undoing.value = true
  try {
    const res = await api.undo()
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
    ElMessage.success(`已还原 ${res.data.restored} 项`)
    await refreshCanUndo()
    await runScan()
  } finally {
    undoing.value = false
  }
}

async function saveSettings() {
  const res = await api.updateSettings({
    folderPrefix: settingsDraft.value.folderPrefix.trim(),
    autoOrganizeOnScan: settingsDraft.value.autoOrganizeOnScan,
    autoOrganizeOnBoot: settingsDraft.value.autoOrganizeOnBoot,
    autoOrganizeOnNewIcons: settingsDraft.value.autoOrganizeOnNewIcons
  })
  if (res.ok) {
    settings.value = res.data
    ElMessage.success('设置已保存')
  } else {
    ElMessage.error(res.error.message)
  }
}

function openCreate() {
  editingCategory.value = null
  editOpen.value = true
  settingsOpen.value = false
}

function openEdit(cat: DesktopCategory) {
  editingCategory.value = cat
  editOpen.value = true
}

async function onCategorySave(payload: {
  name: string
  targetFolderName: string
  icon: string
  color: string
  rules: DesktopCategory['rules']
}) {
  if (editingCategory.value) {
    const res = await api.updateCategory(editingCategory.value.id, payload)
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
  } else {
    const res = await api.createCategory(payload)
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
  }
  await loadCategories()
  if (plan.value) await runScan()
}

async function toggleCategory(cat: DesktopCategory, enabled: boolean) {
  const res = await api.updateCategory(cat.id, { enabled })
  if (res.ok) {
    await loadCategories()
    if (plan.value) await runScan()
  }
}

function onItemDragStart(path: string) {
  dragItemPath.value = path
}

async function onDropToCategory(categoryId: string) {
  if (!dragItemPath.value) return
  const res = await api.setManualAssignment(dragItemPath.value, categoryId)
  dragItemPath.value = null
  if (res.ok) {
    ElMessage.success(`已归入「${categories.value.find((c) => c.id === categoryId)?.name}」`)
    await runScan()
  }
}
</script>

<style scoped>
.desk-org {
  position: relative;
  height: 100vh;
  color: #eef6f8;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.desk-org__bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image:
    linear-gradient(165deg, rgba(12, 45, 58, 0.92) 0%, rgba(28, 78, 88, 0.78) 45%, rgba(45, 95, 105, 0.65) 100%),
    radial-gradient(ellipse 80% 50% at 70% 20%, rgba(120, 180, 190, 0.35), transparent),
    radial-gradient(ellipse 60% 40% at 20% 80%, rgba(60, 100, 110, 0.4), transparent),
    linear-gradient(180deg, #3a6b75 0%, #5a8a94 35%, #7aa8b0 60%, #9ec4cc 100%);
}

.desk-org__bg.has-wallpaper {
  /* 壁纸由 inline style 注入渐变+图片 */
}

.desk-org__subpage {
  position: relative;
  z-index: 10;
  padding: 0 20px 48px;
  max-width: 980px;
  margin: 0 auto;
}

.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.desk-org__top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin: 16px 20px 12px;
  padding: 12px 16px;
  border-radius: 14px;
}

.desk-org__top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.desk-org__top-left h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.desk-org__sub {
  margin: 4px 0 0;
  font-size: 11px;
  opacity: 0.75;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desk-org__link {
  margin-left: 8px;
  border: none;
  background: none;
  color: #a5f3fc;
  cursor: pointer;
  font-size: 11px;
  text-decoration: underline;
}

.desk-org__top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.desk-org__stat {
  font-size: 12px;
  opacity: 0.9;
  margin-right: 4px;
}

.desk-org__pill {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.desk-org__pill:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.desk-org__pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.desk-org__pill--scan {
  background: rgba(56, 189, 248, 0.35);
}

.desk-org__pill--organize {
  background: rgba(251, 191, 36, 0.45);
  color: #1f2937;
  font-weight: 700;
  opacity: 0.65;
}

.desk-org__pill--fence {
  background: rgba(139, 92, 246, 0.45);
  font-weight: 700;
}

.desk-org__pill.is-active {
  background: rgba(110, 168, 254, 0.45);
  border-color: rgba(110, 168, 254, 0.7);
  opacity: 1;
}

.desk-org__pill--organize.is-ready {
  opacity: 1;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.6);
}

.desk-org__icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.desk-org__icon-btn--sm {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.desk-org__icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.desk-org__pages {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 8px;
  margin: 0 20px 12px;
  padding: 6px 10px;
  border-radius: 12px;
}

.desk-org__page {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.desk-org__page:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.desk-org__page.is-active {
  background: rgba(56, 189, 248, 0.35);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.5);
}

.desk-org__tabs {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 0 20px 16px;
  padding: 8px 12px;
  border-radius: 12px;
}

.desk-org__tab {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.desk-org__tab:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.desk-org__tab.is-active {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  font-weight: 600;
}

.desk-org__tab--add {
  margin-left: auto;
  opacity: 0.85;
}

.desk-org__tab-badge {
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
}

.desk-org__canvas {
  position: relative;
  z-index: 10;
  padding: 0 20px 48px;
}

.desk-org__empty {
  max-width: 480px;
  margin: 48px auto;
  padding: 40px 32px;
  border-radius: 20px;
  text-align: center;
}

.desk-org__empty-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.desk-org__empty-desc {
  margin: 0 0 24px;
  font-size: 13px;
  opacity: 0.8;
  line-height: 1.6;
}

.desk-org__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desk-org__big-btn {
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 12px;
  padding: 14px 20px;
  font-size: 15px;
  cursor: pointer;
}

.desk-org__big-btn--primary {
  background: rgba(251, 191, 36, 0.55);
  color: #1f2937;
  font-weight: 700;
  border-color: rgba(251, 191, 36, 0.6);
}

.desk-org__fences {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  align-items: start;
}

.desk-org__fence {
  border-radius: 16px;
  padding: 12px 14px 14px;
  min-height: 160px;
}

.desk-org__fence-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.desk-org__fence-icon {
  font-size: 20px;
}

.desk-org__fence-title {
  font-size: 15px;
  font-weight: 700;
}

.desk-org__fence-path {
  flex: 1;
  font-size: 10px;
  opacity: 0.65;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desk-org__fence-count {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 999px;
}

.desk-org__fence-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.desk-org__fence-empty {
  margin: 24px 0;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
}

.desk-org__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 10px 6px;
}

.desk-org__grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 10px;
  cursor: grab;
  transition: background 0.12s;
}

.desk-org__grid-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.desk-org__grid-icon {
  font-size: 36px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.desk-org__grid-name {
  font-size: 11px;
  text-align: center;
  line-height: 1.25;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.desk-org__result {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.desk-org__warn {
  color: #fecaca;
}

.desk-org__drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.desk-org__drawer-hint {
  margin: -8px 0 0;
  font-size: 12px;
  color: var(--desktop-muted, #888);
  line-height: 1.5;
}

.desk-org__fence-tools :deep(.el-switch) {
  --el-switch-on-color: #38bdf8;
}
</style>

<style>
.el-overlay.is-message-box {
  z-index: 9999 !important;
}
.el-message-box__wrapper {
  z-index: 10000 !important;
}
</style>

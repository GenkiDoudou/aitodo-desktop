<template>
  <!--
    关于：贴 preview.html 居中品牌区 + 链接行。
    保留真实版本与检查更新；隐私/条款内嵌草案；更新日志拉公开仓 Release Body。
  -->
  <section class="settings-section">
    <div class="settings-about">
      <div class="settings-about__logo" aria-hidden="true">✓</div>
      <h2 class="settings-about__name">小柒todo</h2>
      <p class="settings-about__slogan">让每件事都有结果</p>

      <div class="settings-about__links">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">当前版本</div>
            <div class="settings-row__label-desc">
              {{ info?.version ?? status?.currentVersion ?? '-' }}
              <template v-if="status?.state === 'up-to-date'"> · 已是最新版本</template>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">检查更新</div>
            <div class="settings-row__label-desc">{{ statusText }}</div>
          </div>
          <div class="settings-row__control">
            <el-button :loading="checking" @click="onCheck">检查</el-button>
            <el-button v-if="status?.state === 'ready'" type="primary" @click="onQuitAndInstall">
              重启以更新
            </el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">安装形态</div>
            <div class="settings-row__label-desc">
              {{ shapeLabel }}
              <template v-if="status?.feedSource"> · 源：{{ status.feedSource }}</template>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">更新日志</div>
            <div class="settings-row__label-desc">来自公开发版说明（Gitee / GitHub）</div>
          </div>
          <div class="settings-row__control">
            <el-button :loading="changelogLoading" @click="onChangelog">查看</el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">隐私政策</div>
            <div class="settings-row__label-desc">本地优先 · 草案可再审</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="openLegal('privacy')">查看</el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">服务条款</div>
            <div class="settings-row__label-desc">本地优先 · 草案可再审</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="openLegal('terms')">查看</el-button>
          </div>
        </div>
      </div>

      <p v-if="status?.errorMessage" class="settings-about__error">{{ status.errorMessage }}</p>
      <p class="settings-about__copy">© 2026 Todo</p>
    </div>

    <!-- 隐私 / 服务条款 -->
    <el-dialog
      v-model="legalOpen"
      :title="legalTitle"
      width="640px"
      align-center
      destroy-on-close
      class="settings-about-dialog"
    >
      <div class="settings-about-doc" v-html="legalHtml" />
    </el-dialog>

    <!-- 更新日志：公开仓 Release Body -->
    <el-dialog
      v-model="changelogOpen"
      title="更新日志"
      width="680px"
      align-center
      destroy-on-close
      class="settings-about-dialog"
    >
      <p v-if="changelogSource" class="settings-about-changelog__meta">
        数据源：GitHub
      </p>
      <p v-if="changelogError" class="settings-about__error">{{ changelogError }}</p>
      <div v-else-if="changelogLoading" class="settings-about-changelog__loading">加载中…</div>
      <div v-else class="settings-about-changelog">
        <article
          v-for="item in changelogItems"
          :key="item.tag"
          class="settings-about-changelog__item"
        >
          <header class="settings-about-changelog__head">
            <strong>{{ item.title }}</strong>
            <span class="settings-about-changelog__tag">{{ item.tag }}</span>
            <time v-if="item.publishedAt" class="settings-about-changelog__time">
              {{ formatPublished(item.publishedAt) }}
            </time>
          </header>
          <div class="settings-about-doc" v-html="renderMd(item.body)" />
        </article>
      </div>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
/**
 * 设置 · 关于：版本/更新 + 内嵌法律草案弹窗 + 远程 Release 更新日志。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AppInfo } from '@shared/types'
import type {
  AppReleaseChangelogItem,
  AppUpdateStatus,
  InstallShape,
  UpdateFeedSource
} from '@shared/app-update'
import { PRIVACY_POLICY_MARKDOWN, TERMS_OF_SERVICE_MARKDOWN } from '@shared/legal-documents'
import { unwrapIpc } from '@/ipc/client'
import { renderTaskMarkdownHtml } from '@/utils/task-markdown'

const info = ref<AppInfo | null>(null)
const status = ref<AppUpdateStatus | null>(null)
const checking = ref(false)
let cleanupStatus: (() => void) | undefined

const legalOpen = ref(false)
const legalKind = ref<'privacy' | 'terms'>('privacy')
const legalTitle = computed(() => (legalKind.value === 'privacy' ? '隐私政策' : '服务条款'))
const legalHtml = computed(() =>
  renderTaskMarkdownHtml(
    legalKind.value === 'privacy' ? PRIVACY_POLICY_MARKDOWN : TERMS_OF_SERVICE_MARKDOWN
  )
)

const changelogOpen = ref(false)
const changelogLoading = ref(false)
const changelogError = ref('')
const changelogSource = ref<UpdateFeedSource | null>(null)
const changelogItems = ref<AppReleaseChangelogItem[]>([])

const shapeLabel = computed(() => {
  const shape: InstallShape | undefined = status.value?.installShape
  if (shape === 'nsis') return 'Windows 安装版（NSIS）'
  if (shape === 'mac') return 'macOS'
  if (shape === 'portable-dir') return 'Windows 免解压目录'
  return '-'
})

const statusText = computed(() => {
  const s = status.value
  if (!s) return '更新状态：-'
  if (s.message) return s.message
  switch (s.state) {
    case 'idle':
      return '更新状态：空闲'
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 ${s.availableVersion ?? ''}`
    case 'downloading':
      return `正在下载… ${s.progress != null ? `${s.progress}%` : ''}`
    case 'ready':
      return '更新已就绪，可重启安装'
    case 'applying':
      return '正在应用更新…'
    case 'up-to-date':
      return '已是最新版本'
    case 'error':
      return '检查或下载失败'
    default:
      return `更新状态：${s.state}`
  }
})

onMounted(async () => {
  info.value = unwrapIpc(await window.api.app.getInfo())
  status.value = unwrapIpc(await window.api.appUpdate.getStatus())
  cleanupStatus = window.api.appUpdate.onStatus((next) => {
    status.value = next
  })
})

onUnmounted(() => {
  cleanupStatus?.()
})

async function onCheck() {
  checking.value = true
  try {
    status.value = unwrapIpc(await window.api.appUpdate.check())
    if (status.value.state === 'up-to-date') ElMessage.success('已是最新版本')
    else if (status.value.state === 'error') ElMessage.error(status.value.errorMessage || '检查更新失败')
    else if (status.value.state === 'ready') ElMessage.success('更新已下载，请重启以更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '检查更新失败')
  } finally {
    checking.value = false
  }
}

async function onQuitAndInstall() {
  try {
    unwrapIpc(await window.api.appUpdate.quitAndInstall())
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '无法应用更新')
  }
}

function openLegal(kind: 'privacy' | 'terms') {
  legalKind.value = kind
  legalOpen.value = true
}

function renderMd(md: string) {
  return renderTaskMarkdownHtml(md)
}

function formatPublished(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}

async function onChangelog() {
  changelogOpen.value = true
  changelogLoading.value = true
  changelogError.value = ''
  changelogItems.value = []
  changelogSource.value = null
  try {
    const result = unwrapIpc(await window.api.appUpdate.listChangelog())
    changelogSource.value = result.source
    changelogItems.value = result.items
  } catch (err) {
    changelogError.value = err instanceof Error ? err.message : '无法获取更新日志'
  } finally {
    changelogLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.settings-about__error {
  margin: 12px auto 0;
  max-width: 520px;
  font-size: 13px;
  color: var(--el-color-danger);
}

.settings-about-changelog__meta {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--desktop-muted);
}

.settings-about-changelog__loading {
  padding: 24px 0;
  text-align: center;
  color: var(--desktop-muted);
}

.settings-about-changelog {
  max-height: min(60vh, 520px);
  overflow: auto;
  padding-right: 4px;
}

.settings-about-changelog__item {
  padding: 12px 0 16px;
  border-bottom: 1px solid var(--desktop-border);

  &:last-child {
    border-bottom: none;
  }
}

.settings-about-changelog__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;

  strong {
    font-size: 15px;
  }
}

.settings-about-changelog__tag {
  font-size: 12px;
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
  padding: 1px 8px;
  border-radius: 999px;
}

.settings-about-changelog__time {
  margin-left: auto;
  font-size: 12px;
  color: var(--desktop-muted);
}

.settings-about-doc {
  font-size: 13px;
  line-height: 1.65;
  color: var(--desktop-text);

  :deep(h1) {
    font-size: 18px;
    margin: 0 0 12px;
  }

  :deep(h2) {
    font-size: 15px;
    margin: 18px 0 8px;
  }

  :deep(h3) {
    font-size: 14px;
    margin: 14px 0 6px;
  }

  :deep(p),
  :deep(ul),
  :deep(ol) {
    margin: 0 0 10px;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.25em;
  }

  :deep(blockquote) {
    margin: 12px 0;
    padding: 8px 12px;
    border-left: 3px solid #dcdfe6;
    background: #f5f7fa;
    color: #606266;
  }

  :deep(a) {
    color: var(--el-color-primary);
  }
}
</style>

<style lang="scss">
.settings-about-dialog.el-dialog .el-dialog__body {
  max-height: min(70vh, 560px);
  overflow: auto;
  padding-top: 8px;
}
</style>

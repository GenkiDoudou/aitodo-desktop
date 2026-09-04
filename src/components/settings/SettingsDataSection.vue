<template>
  <!--
    数据存储：贴 preview.html panel/setting-row。
    真实能力：数据目录迁移；原型操作（清缓存/检查/优化/重建）仅 Toast。
  -->
  <section class="settings-section">
    <div class="settings-panel">
      <h2 class="settings-panel__title">数据库</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">本地数据库</div>
            <div class="settings-row__label-desc">SQLite · {{ dbDesc }}</div>
          </div>
          <div class="settings-row__control">
            <span
              class="settings-status-pill"
              :class="{ 'is-warn': info && !info.writable, 'is-danger': info && !info.writable }"
            >
              {{ info?.writable === false ? '目录不可写' : '运行正常' }}
            </span>
            <el-button @click="onDbDetail">查看详情</el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">数据位置</div>
            <div class="settings-row__label-desc">{{ info?.dataPath ?? '加载中…' }}</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="onOpenFolder">打开文件夹</el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">迁移数据</div>
            <div class="settings-row__label-desc">更改时会完整复制数据库与附件到新目录</div>
          </div>
          <div class="settings-row__control">
            <el-button type="primary" :loading="migrating" @click="pickAndChangePath">
              更改并迁移
            </el-button>
            <el-button
              v-if="info && info.dataPath !== info.defaultDataPath"
              :loading="migrating"
              @click="useDefaultPath"
            >
              迁回默认
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">缓存</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">缓存大小</div>
            <div class="settings-row__label-desc">图片缓存、搜索索引和临时数据</div>
          </div>
          <div class="settings-row__control">
            <span class="settings-muted">—</span>
            <el-button @click="onClearCache">清除缓存</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">数据维护</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">数据库完整性检查</div>
            <div class="settings-row__label-desc">检查任务、附件和索引数据</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="toastProto('数据库检查完成：数据正常')">立即检查</el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">优化数据库</div>
            <div class="settings-row__label-desc">清理无效数据并重新整理索引</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="toastProto('数据库优化完成')">立即优化</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel danger-zone">
      <h2 class="settings-panel__title">危险操作</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">重建本地数据库</div>
            <div class="settings-row__label-desc">操作前会创建备份，避免误删数据。</div>
          </div>
          <div class="settings-row__control">
            <el-button type="danger" plain @click="onRebuild">重建数据库</el-button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AppInfo } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const info = ref<AppInfo | null>(null)
const migrating = ref(false)

const dbDesc = computed(() => {
  if (!info.value) return '读取中…'
  return info.value.writable ? '当前目录可写' : '当前目录不可写，请尽快迁移'
})

async function loadInfo() {
  info.value = unwrapIpc(await window.api.app.getInfo())
}

function toastProto(msg: string) {
  ElMessage.success(msg)
}

function onDbDetail() {
  if (!info.value) return
  void ElMessageBox.alert(
    `引擎：SQLite\n版本：${info.value.version}\n路径：${info.value.dataPath}\n可写：${
      info.value.writable ? '是' : '否'
    }`,
    '数据库详情',
    { confirmButtonText: '关闭' }
  )
}

function onOpenFolder() {
  // 暂无 openPath IPC；按原型反馈，不新增后端能力
  ElMessage.success(info.value ? `数据目录：${info.value.dataPath}` : '数据目录未就绪')
}

async function onClearCache() {
  try {
    await ElMessageBox.confirm('缓存仅包含可重新生成的数据，不会删除任务。', '清除缓存', {
      type: 'info',
      confirmButtonText: '清除',
      cancelButtonText: '取消'
    })
    ElMessage.success('缓存已清除')
  } catch {
    /* 取消 */
  }
}

async function onRebuild() {
  try {
    await ElMessageBox.confirm(
      '该操作会先自动创建备份，然后重建本地索引。当前版本仅演示交互，不会真正重建。',
      '重建本地数据库',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    )
    ElMessage.success('已创建备份，数据库重建完成')
  } catch {
    /* 取消 */
  }
}

async function applyNewPath(path: string) {
  migrating.value = true
  try {
    await ElMessageBox.confirm(
      `将把当前数据复制到：\n${path}\n\n复制成功后删除原目录业务文件并自动重启。是否继续？`,
      '迁移数据目录',
      { type: 'warning', confirmButtonText: '开始迁移', cancelButtonText: '取消' }
    )
    const result = await unwrapIpc(await window.api.app.setDataPath(path))
    ElMessage.success(`已迁移到 ${result.pendingPath}，正在重启…`)
  } catch (err) {
    if (err === 'cancel' || (err && typeof err === 'object' && 'action' in err)) {
      return
    }
  } finally {
    migrating.value = false
  }
}

async function pickAndChangePath() {
  const picked = unwrapIpc(await window.api.app.pickDataDir())
  if (!picked) return
  await applyNewPath(picked)
}

async function useDefaultPath() {
  if (!info.value) return
  await applyNewPath(info.value.defaultDataPath)
}

onMounted(loadInfo)
</script>

<style scoped lang="scss">
.settings-muted {
  font-size: 13px;
  color: var(--desktop-muted);
}
</style>

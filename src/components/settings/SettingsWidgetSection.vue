<template>
  <section class="settings-section widget-settings">
    <h2 class="settings-section__title">桌面挂件</h2>
    <p class="settings-section__hint">
      将挂件拖到屏幕边缘会自动收成贴边细条，细条会显示挂件名称并停留在你拖放的位置；多个挂件贴在同一边时会自动错开避免重叠。悬停细条可临时展开（移开鼠标即收起），点击细条或按 Mod+Shift+W 可固定展开。
    </p>

    <div class="widget-settings__rows">
      <div class="widget-settings__row">
        <span class="widget-settings__label">启动时打开全部挂件</span>
        <el-switch v-model="form.openOnStartup" @change="saveGlobal" />
      </div>
    </div>

    <div class="widget-settings__toolbar">
      <el-button type="primary" @click="openAddDialog">添加挂件</el-button>
      <el-button @click="showAll">显示全部</el-button>
    </div>

    <div v-if="loading" class="widget-settings__empty">加载中…</div>
    <div v-else-if="instances.length === 0" class="widget-settings__empty">
      还没有挂件，点击「添加挂件」创建第一个。
    </div>
    <div v-else class="widget-settings__list">
      <article v-for="item in instances" :key="item.id" class="widget-settings__card">
        <div class="widget-settings__card-main">
          <div class="widget-settings__card-title">{{ displayName(item) }}</div>
          <div class="widget-settings__card-meta">
            <el-tag size="small" effect="plain">{{ kindLabel(item.kind) }}</el-tag>
            <span v-if="item.kind === 'view' && viewName(item.viewId)" class="widget-settings__view-name">
              {{ viewName(item.viewId) }}
            </span>
          </div>
        </div>
        <div class="widget-settings__card-actions">
          <el-button size="small" @click="openEditDialog(item)">显示设置</el-button>
          <el-button size="small" @click="showOne(item.id)">显示</el-button>
          <el-button size="small" type="danger" plain @click="removeOne(item)">删除</el-button>
        </div>
      </article>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加挂件" width="420px" append-to-body>
      <el-form label-position="top" class="widget-settings__form">
        <el-form-item label="挂件类型">
          <el-radio-group v-model="addForm.kind">
            <el-radio value="notes">便签</el-radio>
            <el-radio value="matrix">四象限</el-radio>
            <el-radio value="view">视图</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="addForm.kind === 'view'" label="选择视图" required>
          <el-select v-model="addForm.viewId" placeholder="请选择要挂起的视图" filterable style="width: 100%">
            <el-option v-for="view in views" :key="view.id" :label="view.name" :value="view.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="显示名称（可选）">
          <el-input v-model="addForm.name" placeholder="留空则使用默认名称" maxlength="40" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="createInstance">添加并显示</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="挂件显示设置" width="440px" append-to-body>
      <el-form v-if="editForm" label-position="top" class="widget-settings__form">
        <el-form-item label="展示模式">
          <el-select v-model="editForm.displayMode" style="width: 100%">
            <el-option
              v-for="(label, key) in displayModeLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editForm.kind !== 'notes'" label="收起策略">
          <el-select v-model="editForm.collapsePolicy" style="width: 100%">
            <el-option
              v-for="(label, key) in collapsePolicyLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editForm.collapsePolicy === 'idle_timeout'" label="空闲超时（秒）">
          <el-input-number v-model="editForm.idleTimeoutSec" :min="5" :max="600" />
        </el-form-item>
        <el-form-item label="边缘锚点（细条/迷你时贴边）">
          <el-select v-model="editForm.edgeAnchor" style="width: 100%">
            <el-option
              v-for="(label, key) in edgeAnchorLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingEdit" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TaskView } from '@shared/types'
import type { WidgetInstance, WidgetKind } from '@shared/widget-notes'
import { WIDGET_KIND_LABELS, widgetInstanceDisplayName } from '@shared/widget-notes'
import {
  WIDGET_COLLAPSE_POLICY_LABELS,
  WIDGET_DISPLAY_MODE_LABELS,
  WIDGET_EDGE_ANCHOR_LABELS,
  type WidgetCollapsePolicy,
  type WidgetDisplayMode,
  type WidgetEdgeAnchor
} from '@shared/widget-display'

const loading = ref(false)
const adding = ref(false)
const savingEdit = ref(false)
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editTargetId = ref('')
const instances = ref<WidgetInstance[]>([])

const displayModeLabels = WIDGET_DISPLAY_MODE_LABELS
const collapsePolicyLabels = WIDGET_COLLAPSE_POLICY_LABELS
const edgeAnchorLabels = WIDGET_EDGE_ANCHOR_LABELS

interface EditFormState {
  kind: WidgetKind
  displayMode: WidgetDisplayMode
  collapsePolicy: WidgetCollapsePolicy
  idleTimeoutSec: number
  edgeAnchor: WidgetEdgeAnchor
}

const editForm = ref<EditFormState | null>(null)
const views = ref<TaskView[]>([])

const form = reactive({
  openOnStartup: false
})

const addForm = reactive({
  kind: 'notes' as WidgetKind,
  viewId: '',
  name: ''
})

const viewMap = computed(() => new Map(views.value.map((view) => [view.id, view.name])))

function kindLabel(kind: WidgetKind): string {
  return WIDGET_KIND_LABELS[kind]
}

function displayName(item: WidgetInstance): string {
  return widgetInstanceDisplayName(item)
}

function viewName(viewId: string | null): string | null {
  if (!viewId) return null
  return viewMap.value.get(viewId) ?? null
}

async function loadViews() {
  const res = await window.api.taskViews.list()
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  views.value = res.data
}

async function loadInstances() {
  loading.value = true
  const [settingsRes, listRes] = await Promise.all([
    window.api.widget.getSettings(),
    window.api.widgetInstances.list()
  ])
  loading.value = false
  if (!settingsRes.ok) {
    ElMessage.error(settingsRes.error.message)
    return
  }
  if (!listRes.ok) {
    ElMessage.error(listRes.error.message)
    return
  }
  form.openOnStartup = settingsRes.data.openOnStartup
  instances.value = listRes.data
}

async function saveGlobal() {
  const res = await window.api.widget.updateSettings({
    openOnStartup: form.openOnStartup
  })
  if (!res.ok) {
    ElMessage.error(res.error.message)
  }
}

function openAddDialog() {
  addForm.kind = 'notes'
  addForm.viewId = ''
  addForm.name = ''
  addDialogVisible.value = true
}

async function createInstance() {
  if (addForm.kind === 'view' && !addForm.viewId) {
    ElMessage.warning('请选择要挂起的视图')
    return
  }
  adding.value = true
  const res = await window.api.widgetInstances.create({
    kind: addForm.kind,
    viewId: addForm.kind === 'view' ? addForm.viewId : null,
    name: addForm.name.trim() || undefined
  })
  adding.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  addDialogVisible.value = false
  await loadInstances()
  await window.api.widgetInstances.show(res.data.id)
  ElMessage.success('挂件已添加')
}

async function showOne(id: string) {
  const res = await window.api.widgetInstances.show(id)
  if (!res.ok) {
    ElMessage.error(res.error.message)
  }
}

function openEditDialog(item: WidgetInstance) {
  editTargetId.value = item.id
  editForm.value = {
    kind: item.kind,
    displayMode: item.displayMode,
    collapsePolicy: item.collapsePolicy,
    idleTimeoutSec: item.idleTimeoutSec,
    edgeAnchor: item.edgeAnchor
  }
  editDialogVisible.value = true
}

async function saveEdit() {
  if (!editForm.value || !editTargetId.value) return
  savingEdit.value = true
  const res = await window.api.widgetInstances.update(editTargetId.value, {
    displayMode: editForm.value.displayMode,
    collapsePolicy: editForm.value.collapsePolicy,
    idleTimeoutSec: editForm.value.idleTimeoutSec,
    edgeAnchor: editForm.value.edgeAnchor
  })
  savingEdit.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  editDialogVisible.value = false
  await loadInstances()
  ElMessage.success('显示设置已保存')
}

async function showAll() {
  const res = await window.api.widget.show()
  if (!res.ok) {
    ElMessage.error(res.error.message)
  }
}

async function removeOne(item: WidgetInstance) {
  try {
    await ElMessageBox.confirm(`确定删除挂件「${displayName(item)}」吗？`, '删除挂件', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  const res = await window.api.widgetInstances.delete(item.id)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await loadInstances()
  ElMessage.success('挂件已删除')
}

onMounted(() => {
  void loadViews()
  void loadInstances()
})
</script>

<style scoped lang="scss">
.widget-settings__rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 520px;
}

.widget-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.widget-settings__label {
  font-size: 14px;
  color: var(--desktop-text);
}

.widget-settings__toolbar {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.widget-settings__empty {
  margin-top: 20px;
  padding: 28px;
  border: 1px dashed var(--desktop-border);
  border-radius: 12px;
  color: var(--desktop-muted);
  text-align: center;
  font-size: 13px;
}

.widget-settings__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
  max-width: 640px;
}

.widget-settings__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: var(--desktop-panel);
}

.widget-settings__card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
}

.widget-settings__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.widget-settings__view-name {
  font-size: 12px;
  color: var(--desktop-muted);
}

.widget-settings__card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.widget-settings__form {
  padding-top: 4px;
}
</style>

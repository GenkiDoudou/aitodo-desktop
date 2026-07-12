<template>
  <div class="org-rules">
    <header class="org-rules__head">
      <div>
        <h2>整理规则</h2>
        <p>自定义规则优先级高于默认规则；启用后桌面文件会优先按自定义规则归类</p>
      </div>
      <el-button type="primary" @click="openCreate">+ 自定义规则</el-button>
    </header>

    <section class="org-rules__section glass">
      <div class="org-rules__section-head">
        <h3>默认规则</h3>
      </div>
      <el-table :data="defaultRules" size="small" class="org-rules__table">
        <el-table-column prop="label" label="类型" width="100" />
        <el-table-column prop="extensionsHint" label="包含后缀" min-width="180" show-overflow-tooltip />
        <el-table-column label="整理到对应分区" width="140">
          <template #default="{ row }">
            <span>{{ categoryName(row.categoryId) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="是否启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :disabled="row.categoryId === 'uncategorized'"
              @change="(v: boolean) => toggleDefault(row.categoryId, v)"
            />
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="org-rules__section glass">
      <div class="org-rules__section-head">
        <h3>自定义规则</h3>
      </div>
      <el-table v-if="customRules.length" :data="customRules" size="small" class="org-rules__table">
        <el-table-column prop="name" label="规则名" width="120" />
        <el-table-column label="匹配方式" width="90">
          <template #default="{ row }">{{ row.matchType === 'keyword' ? '关键字' : '后缀' }}</template>
        </el-table-column>
        <el-table-column prop="matchValue" label="匹配值" min-width="120" show-overflow-tooltip />
        <el-table-column label="目标分区" width="120">
          <template #default="{ row }">{{ categoryName(row.categoryId) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="70" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v: boolean) => toggleCustom(row.id, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeRule(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="org-rules__empty">暂无自定义规则。例如：关键字「双十一」→ 分区「双十一活动」</p>
    </section>

    <DesktopCustomRuleDialog
      v-model="dialogOpen"
      :categories="categories"
      :rule="editingRule"
      @save="onSave"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DesktopCustomRuleDialog from '@/components/DesktopCustomRuleDialog.vue'
import type {
  CreateDesktopCustomRuleDto,
  DesktopCategory,
  DesktopCustomRule,
  DesktopDefaultRuleRow
} from '@shared/desktop-organize-types'

const props = defineProps<{ categories: DesktopCategory[] }>()
const api = window.api.desktopOrganize

const defaultRules = ref<DesktopDefaultRuleRow[]>([])
const customRules = ref<DesktopCustomRule[]>([])
const dialogOpen = ref(false)
const editingRule = ref<DesktopCustomRule | null>(null)

function categoryName(id: string): string {
  return props.categories.find((c) => c.id === id)?.name ?? id
}

async function load() {
  const [defRes, customRes] = await Promise.all([api.listDefaultRules(), api.listCustomRules()])
  if (defRes.ok) defaultRules.value = defRes.data
  if (customRes.ok) customRules.value = customRes.data
}

async function toggleDefault(categoryId: string, enabled: boolean) {
  const res = await api.setDefaultRuleEnabled(categoryId, enabled)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await load()
}

async function toggleCustom(id: string, enabled: boolean) {
  const res = await api.updateCustomRule(id, { enabled })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await load()
}

function openCreate() {
  editingRule.value = null
  dialogOpen.value = true
}

function openEdit(rule: DesktopCustomRule) {
  editingRule.value = rule
  dialogOpen.value = true
}

async function onSave(dto: CreateDesktopCustomRuleDto, id?: string) {
  const res = id ? await api.updateCustomRule(id, dto) : await api.createCustomRule(dto)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  ElMessage.success(id ? '规则已更新' : '规则已创建')
  dialogOpen.value = false
  await load()
}

async function removeRule(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该自定义规则？', '删除规则', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteCustomRule(id)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  ElMessage.success('已删除')
  await load()
}

onMounted(() => {
  void load()
})

defineExpose({ reload: load })
</script>

<style scoped>
.org-rules {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 4px 24px;
}

.org-rules__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.org-rules__head h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.org-rules__head p {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  max-width: 520px;
  line-height: 1.5;
}

.org-rules__section {
  padding: 14px 16px;
  border-radius: 14px;
}

.org-rules__section.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.org-rules__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.org-rules__section-head h3 {
  margin: 0;
  font-size: 14px;
}

.org-rules__table {
  width: 100%;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.08);
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.1);
  --el-table-border-color: rgba(255, 255, 255, 0.14);
  --el-table-text-color: rgba(238, 246, 248, 0.95);
  --el-table-header-text-color: rgba(255, 255, 255, 0.85);
  background: transparent;
}

.org-rules__table :deep(.el-table__inner-wrapper::before) {
  background-color: rgba(255, 255, 255, 0.14);
}

.org-rules__table :deep(.el-table),
.org-rules__table :deep(.el-table__expanded-cell) {
  background: transparent;
}

.org-rules__table :deep(th.el-table__cell),
.org-rules__table :deep(td.el-table__cell) {
  background: transparent;
}

.org-rules__table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: rgba(255, 255, 255, 0.08) !important;
}

.org-rules__table :deep(.el-button.is-link) {
  color: #a5f3fc;
}

.org-rules__table :deep(.el-button.is-link.el-button--danger) {
  color: #fca5a5;
}

.org-rules__table :deep(.el-switch) {
  --el-switch-on-color: #38bdf8;
}

.org-rules__empty {
  margin: 12px 0 4px;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
}
</style>

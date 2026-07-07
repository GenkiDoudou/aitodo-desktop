<template>
  <section class="settings-section" :class="{ 'settings-section--embedded': embedded }">
    <div class="settings-section__head">
      <div v-if="!embedded">
        <h2 class="settings-section__title">定时汇总</h2>
        <p class="settings-section__hint">
          按每天/每周/每月在指定时间推送任务汇总，支持模板与多区块配置（已完成/未完成/逾期等）。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新建汇总</el-button>
    </div>

    <div v-loading="summaryStore.loading" class="settings-section__list">
      <p v-if="!summaryStore.loading && summaryStore.items.length === 0" class="settings-section__empty">
        暂无汇总任务，点击「新建汇总」创建
      </p>

      <article v-for="item in summaryStore.items" :key="item.id" class="summary-card">
        <header class="summary-card__head">
          <div>
            <h3 class="summary-card__title">{{ item.name }}</h3>
            <p class="summary-card__meta">{{ scheduleLabel(item) }} · {{ sendTimeLabel(item) }}</p>
          </div>
          <el-switch v-model="item.enabled" @change="(v: boolean) => onToggleEnabled(item, v)" />
        </header>
        <p class="summary-card__cats">{{ categoryLabel(item) }}</p>
        <p class="summary-card__report">{{ reportLabel(item) }}</p>
        <p v-if="item.useLlm" class="summary-card__llm">已启用大模型优化</p>
        <p v-if="item.lastSentAt" class="summary-card__last">上次发送：{{ formatTime(item.lastSentAt) }}</p>
        <div class="summary-card__actions">
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="onDelete(item)">删除</el-button>
        </div>
      </article>
    </div>

    <el-dialog
      v-model="dialogOpen"
      :title="editingId ? '编辑汇总' : '新建汇总'"
      width="560px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form label-position="top" class="settings-section__form" @submit.prevent="save">
        <el-form-item label="汇总名称" required>
          <el-input v-model="form.name" placeholder="例如：每日工作回顾" />
        </el-form-item>

        <el-form-item label="汇总模板">
          <el-select v-model="selectedTemplateId" placeholder="选择模板" @change="onTemplateChange">
            <el-option
              v-for="tpl in reportTemplates"
              :key="tpl.id"
              :label="tpl.name"
              :value="tpl.id"
            >
              <div class="template-option">
                <span>{{ tpl.name }}</span>
                <span class="template-option__desc">{{ tpl.description }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="报告内容">
          <div class="report-sections">
            <article
              v-for="(section, index) in form.reportConfig.sections"
              :key="section.id"
              class="report-section"
            >
              <div class="report-section__head">
                <el-checkbox v-model="section.enabled">启用</el-checkbox>
                <el-button
                  v-if="form.reportConfig.sections.length > 1"
                  link
                  type="danger"
                  @click="removeSection(index)"
                >
                  删除
                </el-button>
              </div>
              <el-input v-model="section.title" placeholder="区块标题" />
              <div class="report-section__row">
                <el-select v-model="section.taskFilter" placeholder="任务范围" @change="markCustomTemplate">
                  <el-option
                    v-for="(label, key) in taskFilterLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
                <el-select v-model="section.timeScope" placeholder="时间范围" @change="markCustomTemplate">
                  <el-option
                    v-for="(label, key) in timeScopeLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
              </div>
            </article>
            <el-button plain @click="addSection">添加区块</el-button>
          </div>
        </el-form-item>

        <el-form-item label="指定分类（可多选，不选表示全部）">
          <el-select v-model="form.categoryIds" multiple clearable collapse-tags placeholder="全部清单">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="汇总周期" required>
          <el-select v-model="form.scheduleType">
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="每月" value="monthly" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.scheduleType === 'weekly'" label="每周发送日">
          <el-select v-model="form.sendWeekday">
            <el-option v-for="w in weekdays" :key="w.value" :label="w.label" :value="w.value" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.scheduleType === 'monthly'" label="每月发送日">
          <el-input-number v-model="form.sendDay" :min="1" :max="31" />
        </el-form-item>

        <el-form-item label="发送时间" required>
          <el-time-select
            v-model="form.sendTime"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="大模型优化">
          <el-switch v-model="form.useLlm" />
          <span class="settings-section__inline-hint">开启后将使用下方提示词优化汇总内容</span>
        </el-form-item>

        <el-form-item v-if="form.useLlm" label="选择提示词">
          <el-select v-model="selectedPromptId" placeholder="默认汇总提示词" clearable @change="onPromptSelected">
            <el-option label="默认汇总提示词" value="" />
            <el-option
              v-for="p in promptOptions"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.useLlm" label="提示词内容">
          <el-input v-model="form.promptText" type="textarea" :rows="8" resize="vertical" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button native-type="button" @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" native-type="button" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Category, ScheduledSummary, SummaryScheduleType } from '@shared/types'
import {
  DEFAULT_SUMMARY_PROMPT,
  SUMMARY_SCHEDULE_LABELS,
  applySummaryReportTemplate,
  cloneReportConfig,
  createReportSection,
  describeReportConfig,
  normalizeReportConfig,
  normalizeSendTime,
  SUMMARY_REPORT_TEMPLATES,
  SUMMARY_TASK_FILTER_LABELS,
  SUMMARY_TIME_SCOPE_LABELS,
  type SummaryReportConfig
} from '@shared/scheduled-summary'
import { useScheduledSummaryStore } from '@/stores/scheduled-summary-store'
import { useCategoryStore } from '@/stores/category-store'
import { useAiPromptStore } from '@/stores/ai-prompt-store'

withDefaults(
  defineProps<{
    /** 嵌入首页主区域时隐藏区块标题 */
    embedded?: boolean
  }>(),
  { embedded: false }
)

const summaryStore = useScheduledSummaryStore()
const categoryStore = useCategoryStore()
const promptStore = useAiPromptStore()

const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const selectedPromptId = ref('')

const selectedTemplateId = ref('daily_completed')

const form = reactive({
  name: '',
  categoryIds: [] as string[],
  scheduleType: 'daily' as SummaryScheduleType,
  sendTime: '09:00',
  sendWeekday: 1,
  sendDay: 1,
  useLlm: false,
  promptText: DEFAULT_SUMMARY_PROMPT,
  reportConfig: cloneReportConfig(applySummaryReportTemplate('daily_completed'))
})

const reportTemplates = SUMMARY_REPORT_TEMPLATES
const taskFilterLabels = SUMMARY_TASK_FILTER_LABELS
const timeScopeLabels = SUMMARY_TIME_SCOPE_LABELS

const categories = computed<Category[]>(() => categoryStore.categories)

const promptOptions = computed(() => promptStore.config?.customPrompts ?? [])

function onPromptSelected(id: string) {
  if (!id) {
    form.promptText = DEFAULT_SUMMARY_PROMPT
    return
  }
  const picked = promptOptions.value.find((p) => p.id === id)
  if (picked) {
    form.promptText = picked.content
  }
}

const weekdays = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' }
]

function scheduleLabel(item: ScheduledSummary) {
  return SUMMARY_SCHEDULE_LABELS[item.scheduleType]
}

function sendTimeLabel(item: ScheduledSummary) {
  if (item.scheduleType === 'weekly') {
    const w = weekdays.find((d) => d.value === item.sendWeekday)?.label ?? ''
    return `${w} ${item.sendTime}`
  }
  if (item.scheduleType === 'monthly') {
    return `每月 ${item.sendDay} 日 ${item.sendTime}`
  }
  return `每天 ${item.sendTime}`
}

function categoryLabel(item: ScheduledSummary) {
  if (!item.categoryIds.length) return '分类：全部清单'
  const names = item.categoryIds
    .map((id) => categories.value.find((c) => c.id === id)?.name)
    .filter(Boolean)
  return `分类：${names.join('、')}`
}

function formatTime(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}

function reportLabel(item: ScheduledSummary) {
  return `内容：${describeReportConfig(item.reportConfig)}`
}

function onTemplateChange(templateId: string) {
  form.reportConfig = cloneReportConfig(applySummaryReportTemplate(templateId))
}

function markCustomTemplate() {
  selectedTemplateId.value = 'custom'
  form.reportConfig.templateId = 'custom'
}

function addSection() {
  markCustomTemplate()
  form.reportConfig.sections.push(createReportSection())
}

function removeSection(index: number) {
  markCustomTemplate()
  form.reportConfig.sections.splice(index, 1)
}

function resetForm() {
  editingId.value = null
  selectedPromptId.value = ''
  selectedTemplateId.value = 'daily_completed'
  form.name = ''
  form.categoryIds = []
  form.scheduleType = 'daily'
  form.sendTime = '09:00'
  form.sendWeekday = 1
  form.sendDay = 1
  form.useLlm = false
  form.promptText = DEFAULT_SUMMARY_PROMPT
  form.reportConfig = cloneReportConfig(applySummaryReportTemplate('daily_completed'))
}

function openCreate() {
  resetForm()
  dialogOpen.value = true
}

function openEdit(item: ScheduledSummary) {
  editingId.value = item.id
  form.name = item.name
  form.categoryIds = [...item.categoryIds]
  form.scheduleType = item.scheduleType
  form.sendTime = item.sendTime
  form.sendWeekday = item.sendWeekday ?? 1
  form.sendDay = item.sendDay ?? 1
  form.useLlm = item.useLlm
  form.promptText = item.promptText ?? DEFAULT_SUMMARY_PROMPT
  form.reportConfig = cloneReportConfig(normalizeReportConfig(item.reportConfig))
  selectedTemplateId.value = form.reportConfig.templateId ?? 'custom'
  dialogOpen.value = true
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写汇总名称')
    return
  }
  const enabledSections = form.reportConfig.sections.filter((section) => section.enabled)
  if (!enabledSections.length) {
    ElMessage.warning('请至少启用一个报告区块')
    return
  }
  saving.value = true
  try {
    const reportConfig: SummaryReportConfig = cloneReportConfig({
      templateId: selectedTemplateId.value,
      sections: form.reportConfig.sections.map((section) => ({ ...section }))
    })
    const payload = {
      name: form.name.trim(),
      categoryIds: [...form.categoryIds],
      scheduleType: form.scheduleType,
      sendTime: normalizeSendTime(form.sendTime),
      sendWeekday: form.scheduleType === 'weekly' ? form.sendWeekday : null,
      sendDay: form.scheduleType === 'monthly' ? form.sendDay : null,
      useLlm: form.useLlm,
      promptText: form.useLlm ? form.promptText : null,
      reportConfig
    }
    if (editingId.value) {
      await summaryStore.update(editingId.value, payload)
      ElMessage.success('汇总已更新')
    } else {
      await summaryStore.create(payload)
      ElMessage.success('汇总已创建')
    }
    await summaryStore.load()
    dialogOpen.value = false
  } catch {
    /* store / unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

async function onToggleEnabled(item: ScheduledSummary, enabled: boolean) {
  try {
    await summaryStore.update(item.id, { enabled })
  } catch {
    item.enabled = !enabled
  }
}

async function onDelete(item: ScheduledSummary) {
  try {
    await ElMessageBox.confirm(`确定删除汇总「${item.name}」？`, '删除汇总', { type: 'warning' })
  } catch {
    return
  }
  try {
    await summaryStore.remove(item.id)
    ElMessage.success('已删除')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

onMounted(async () => {
  await categoryStore.load()
  if (!promptStore.loaded) {
    await promptStore.load()
  }
  await summaryStore.load()
})
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 820px;

  &--embedded {
    max-width: none;
    padding: 0 20px 24px;
  }
}

.settings-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  margin: 0;
  font-size: 13px;
  color: var(--desktop-muted);
  line-height: 1.5;
}

.settings-section__empty {
  color: var(--desktop-muted);
  font-size: 14px;
}

.summary-card {
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--desktop-panel);
}

.summary-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.summary-card__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.summary-card__meta {
  margin: 0;
  font-size: 13px;
  color: var(--desktop-muted);
}

.summary-card__cats,
.summary-card__report,
.summary-card__llm,
.summary-card__last {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--desktop-muted);
}

.summary-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.settings-section__inline-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--desktop-muted);
}

.template-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.template-option__desc {
  font-size: 12px;
  color: var(--desktop-muted);
}

.report-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.report-section {
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--desktop-panel);
}

.report-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.report-section__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>

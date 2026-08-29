<template>
  <section class="settings-section" :class="{ 'settings-section--embedded': embedded }">
    <div class="settings-section__head">
      <div v-if="!embedded">
        <h2 class="settings-section__title">定时汇总</h2>
        <p class="settings-section__hint">
          按每天/每周/每月推送任务汇总；支持多区块 Query/Time/Group/Render 配置。
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
          <el-button size="small" type="primary" plain :loading="runningId === item.id" @click="onRunNow(item)">
            <!-- onRunNow：立即生成一条/多条站内“定时汇总”消息，不写 lastSentAt，用来不占自动门禁名额 -->
            立即生成
          </el-button>
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="onDelete(item)">删除</el-button>
        </div>
      </article>
    </div>

    <el-dialog
      v-model="dialogOpen"
      :title="editingId ? '编辑汇总' : '新建汇总'"
      width="720px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form label-position="top" class="settings-section__form" @submit.prevent="save">
        <el-form-item label="汇总名称" required>
          <el-input v-model="form.name" placeholder="例如：每日工作回顾" />
        </el-form-item>

        <el-form-item label="配置模式">
          <el-radio-group v-model="form.reportConfig.mode">
            <el-radio-button value="form">表单配置</el-radio-button>
            <el-radio-button value="template">自由模板</el-radio-button>
          </el-radio-group>
          <p class="settings-section__mode-hint">两套配置独立保存，切换不会互相覆盖。</p>
        </el-form-item>

        <template v-if="form.reportConfig.mode === 'form'">
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
                <div class="report-section__move">
                  <el-button link :disabled="index === 0" @click="moveSection(index, -1)">上移</el-button>
                  <el-button
                    link
                    :disabled="index === form.reportConfig.sections.length - 1"
                    @click="moveSection(index, 1)"
                  >
                    下移
                  </el-button>
                  <el-button
                    v-if="form.reportConfig.sections.length > 1"
                    link
                    type="danger"
                    @click="removeSection(index)"
                  >
                    删除
                  </el-button>
                </div>
              </div>

              <el-input v-model="section.title" placeholder="区块标题" @input="markCustomTemplate" />

              <div class="report-section__row">
                <el-select
                  v-model="section.query.status"
                  placeholder="任务范围"
                  @change="onStatusChange(section)"
                >
                  <el-option
                    v-for="(label, key) in taskFilterLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
                <el-select
                  v-model="section.time.preset"
                  placeholder="时间范围"
                  @change="markCustomTemplate"
                >
                  <el-option
                    v-for="(label, key) in timeScopeLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
              </div>

              <div class="report-section__row">
                <el-select
                  v-model="section.query.listScope.mode"
                  placeholder="清单范围"
                  @change="onListScopeModeChange(section)"
                >
                  <el-option label="全部清单（跟随汇总）" value="all" />
                  <el-option label="只看某清单" value="only_list" />
                </el-select>
                <el-select
                  v-if="section.query.listScope.mode === 'only_list'"
                  v-model="section.query.listScope.listId"
                  placeholder="选择清单"
                  @change="markCustomTemplate"
                >
                  <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
              </div>

              <el-checkbox
                :model-value="section.query.dueScope === 'due_today_only'"
                @change="(v: boolean) => onDueTodayChange(section, v)"
              >
                只看今天到期（dueAt 落在今天 00:00–23:59）
              </el-checkbox>

              <div class="report-section__row">
                <el-select v-model="section.group.by" placeholder="分组" @change="markCustomTemplate">
                  <el-option
                    v-for="(label, key) in groupByLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
                <el-select v-model="section.render.style" placeholder="列表样式" @change="markCustomTemplate">
                  <el-option
                    v-for="(label, key) in listStyleLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
              </div>

              <div class="report-section__checks">
                <el-checkbox v-model="section.render.showCount" @change="markCustomTemplate">显示数量</el-checkbox>
                <el-checkbox v-model="section.render.showDueAt" @change="markCustomTemplate">显示截止时间</el-checkbox>
                <el-checkbox v-model="section.render.showCompletedAt" @change="markCustomTemplate">
                  显示完成时间
                </el-checkbox>
                <el-checkbox v-model="section.render.hideEmptySection" @change="markCustomTemplate">
                  隐藏空区块
                </el-checkbox>
              </div>

              <el-form-item label="最多显示条数（空=不限制）" class="report-section__limit">
                <el-input-number
                  v-model="section.render.limit"
                  :min="1"
                  :max="500"
                  controls-position="right"
                  @change="markCustomTemplate"
                />
              </el-form-item>
            </article>
            <el-button plain @click="addSection">添加区块</el-button>
          </div>
        </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="自由模板">
            <div class="free-template">
              <div class="free-template__toolbar">
                <el-dropdown trigger="click" @command="insertPreset">
                  <el-button size="small">插入场景块</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="p in freeTemplatePresets"
                        :key="p.key"
                        :command="p.key"
                      >
                        {{ p.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button size="small" @click="insertSnippet('section')">section 骨架</el-button>
                <el-button size="small" @click="insertSnippet('tasks')">tasks 循环</el-button>
                <el-button
                  v-for="f in fieldChips"
                  :key="f"
                  size="small"
                  @click="insertText(`{{${f}}}`)"
                >
                  {{ f }}
                </el-button>
                <el-button size="small" link @click="showSyntaxHelp = !showSyntaxHelp">
                  {{ showSyntaxHelp ? '隐藏语法速查' : '语法速查' }}
                </el-button>
              </div>
              <el-collapse-transition>
                <pre v-if="showSyntaxHelp" class="free-template__help">{{ syntaxHelp }}</pre>
              </el-collapse-transition>
              <el-input
                ref="templateInputRef"
                v-model="form.reportConfig.freeTemplate.body"
                type="textarea"
                :rows="14"
                resize="vertical"
                placeholder="在此编写自由模板… 可用「插入场景块」或语法速查"
                @input="templateError = ''"
              />
              <p v-if="templateError" class="free-template__error">{{ templateError }}</p>
            </div>
          </el-form-item>
        </template>

        <el-form-item label="指定分类（可多选，不选表示全部；可被区块「只看某清单」覆盖）">
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

        <el-form-item label="预览">
          <div class="preview-box">
            <div class="preview-box__actions">
              <el-button :loading="previewing" @click="preview">生成预览（不发送）</el-button>
              <el-button
                v-if="previewText"
                :disabled="!previewText"
                @click="copyPreview"
              >
                复制预览
              </el-button>
            </div>
            <pre v-if="previewText" class="preview-box__text">{{ previewText }}</pre>
          </div>
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
  DEFAULT_FREE_TEMPLATE_BODY,
  SUMMARY_SCHEDULE_LABELS,
  applySummaryReportTemplate,
  cloneReportConfig,
  createReportSectionV2,
  createDefaultFreeTemplate,
  describeReportConfig,
  normalizeReportConfigV2,
  normalizeSendTime,
  SUMMARY_REPORT_TEMPLATES,
  SUMMARY_TASK_FILTER_LABELS,
  SUMMARY_TIME_SCOPE_LABELS,
  SUMMARY_GROUP_BY_LABELS,
  SUMMARY_LIST_STYLE_LABELS,
  type SummaryReportConfig,
  type SummaryReportSectionV2,
  type SummaryTaskFilter
} from '@shared/scheduled-summary'
import { useScheduledSummaryStore } from '@/stores/scheduled-summary-store'
import { useCategoryStore } from '@/stores/category-store'
import { useAiPromptStore } from '@/stores/ai-prompt-store'
import { unwrapIpc } from '@/ipc/client'
import { toPlainScheduledSummaryDto } from '@shared/scheduled-summary'

withDefaults(
  defineProps<{
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
const runningId = ref<string | null>(null)
const previewing = ref(false)
const previewText = ref('')
const templateError = ref('')
const showSyntaxHelp = ref(false)
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

const syntaxHelp = `自由模板语法（syntaxVersion=1）

【区块】{{#section ...}} ... {{/section}}
  status   必填 completed | pending | overdue
  time     可选 today | yesterday | this_week | last_week | this_month | last_month
           | last_7_days | last_30_days | since_last
           （completed 默认 since_last；pending/overdue 默认 today）
  due      可选 today（只看今天到期）
  list     可选，清单名称（按名称匹配）
  title    可选，区块标题（默认用 status）
  hideEmpty 可选 true|false（空区块是否隐藏）

【任务循环】{{#tasks}} ... {{/tasks}}（须在 section 内）
【条件】{{#if dueAt}} ... {{/if}}
【字段】{{title}} {{dueAt}} {{completedAt}} {{categoryName}} {{status}} {{count}} {{sectionTitle}}

—— 示例：昨天已完成 ——
{{#section status="completed" time="yesterday" title="昨天已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}{{#if completedAt}}（完成于 {{completedAt}}）{{/if}}
{{/tasks}}
{{/section}}

—— 示例：本周待办 ——
{{#section status="pending" time="this_week" title="本周待办" hideEmpty="true"}}
【{{sectionTitle}}】{{count}} 项
{{#tasks}}
- {{title}}{{#if dueAt}}（截止 {{dueAt}}）{{/if}}
{{/tasks}}
{{/section}}`

const fieldChips = ['title', 'dueAt', 'completedAt', 'categoryName', 'count', 'sectionTitle'] as const

const freeTemplatePresets: Array<{ key: string; label: string; body: string }> = [
  {
    key: 'today_done',
    label: '今日已完成',
    body: `{{#section status="completed" time="today" title="今日已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}
{{/tasks}}
{{/section}}
`
  },
  {
    key: 'yesterday_done',
    label: '昨天已完成',
    body: `{{#section status="completed" time="yesterday" title="昨天已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}
{{/tasks}}
{{/section}}
`
  },
  {
    key: 'week_pending',
    label: '本周待办',
    body: `{{#section status="pending" time="this_week" title="本周待办" hideEmpty="true"}}
【{{sectionTitle}}】{{count}} 项
{{#tasks}}
- {{title}}{{#if dueAt}}（截止 {{dueAt}}）{{/if}}
{{/tasks}}
{{/section}}
`
  },
  {
    key: 'last_week_done',
    label: '上周已完成',
    body: `{{#section status="completed" time="last_week" title="上周已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}
{{/tasks}}
{{/section}}
`
  }
]

const SNIPPETS = {
  section: `{{#section status="pending" due="today" title="今日待办" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}{{#if dueAt}}（截止 {{dueAt}}）{{/if}}
{{/tasks}}
{{/section}}
`,
  tasks: `{{#tasks}}
- {{title}}
{{/tasks}}
`,
  fields: `{{title}} {{dueAt}} {{completedAt}} {{categoryName}} {{count}} {{sectionTitle}}`
} as const

function insertText(text: string) {
  const body = form.reportConfig.freeTemplate.body || ''
  form.reportConfig.freeTemplate.body = body.trim()
    ? `${body.replace(/\s*$/, '')}\n${text}`
    : text
  templateError.value = ''
}

function insertSnippet(kind: keyof typeof SNIPPETS) {
  insertText(SNIPPETS[kind])
}

function insertPreset(key: string) {
  const p = freeTemplatePresets.find((x) => x.key === key)
  if (p) insertText(p.body)
}

async function copyPreview() {
  if (!previewText.value) return
  try {
    await navigator.clipboard.writeText(previewText.value)
    ElMessage.success('已复制预览')
  } catch {
    ElMessage.error('复制失败')
  }
}

const reportTemplates = SUMMARY_REPORT_TEMPLATES
const taskFilterLabels = SUMMARY_TASK_FILTER_LABELS
const timeScopeLabels = SUMMARY_TIME_SCOPE_LABELS
const groupByLabels = SUMMARY_GROUP_BY_LABELS
const listStyleLabels = SUMMARY_LIST_STYLE_LABELS

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
  const previousFree = form.reportConfig.freeTemplate
  const previousMode = form.reportConfig.mode
  form.reportConfig = cloneReportConfig(applySummaryReportTemplate(templateId))
  // 预设模板只替换 form sections，保留已有自由模板与当前 mode
  form.reportConfig.freeTemplate = previousFree?.body
    ? { ...previousFree }
    : createDefaultFreeTemplate()
  form.reportConfig.mode = previousMode
  previewText.value = ''
}

function markCustomTemplate() {
  selectedTemplateId.value = 'custom'
  form.reportConfig.templateId = 'custom'
}

function onStatusChange(section: SummaryReportSectionV2) {
  markCustomTemplate()
  const status = section.query.status as SummaryTaskFilter
  if (status === 'completed') {
    section.render.showCompletedAt = true
    section.render.showDueAt = false
    section.sort.field = 'completedAt'
    section.sort.order = 'desc'
  } else {
    section.render.showCompletedAt = false
    section.render.showDueAt = true
    section.sort.field = 'dueAt'
    section.sort.order = 'asc'
  }
}

function onListScopeModeChange(section: SummaryReportSectionV2) {
  markCustomTemplate()
  if (section.query.listScope.mode === 'all') {
    section.query.listScope.listId = undefined
  } else if (!section.query.listScope.listId && categories.value[0]) {
    section.query.listScope.listId = categories.value[0].id
  }
}

function onDueTodayChange(section: SummaryReportSectionV2, checked: boolean) {
  markCustomTemplate()
  section.query.dueScope = checked ? 'due_today_only' : null
}

function addSection() {
  markCustomTemplate()
  form.reportConfig.sections.push(createReportSectionV2())
}

function removeSection(index: number) {
  markCustomTemplate()
  form.reportConfig.sections.splice(index, 1)
}

function moveSection(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= form.reportConfig.sections.length) return
  markCustomTemplate()
  const list = form.reportConfig.sections
  const tmp = list[index]
  list[index] = list[next]
  list[next] = tmp
}

function resetForm() {
  editingId.value = null
  selectedPromptId.value = ''
  selectedTemplateId.value = 'daily_completed'
  previewText.value = ''
  templateError.value = ''
  showSyntaxHelp.value = false
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
  form.reportConfig = cloneReportConfig(normalizeReportConfigV2(item.reportConfig))
  selectedTemplateId.value = form.reportConfig.templateId ?? 'custom'
  previewText.value = ''
  dialogOpen.value = true
}

function buildPayload() {
  const reportConfig: SummaryReportConfig = cloneReportConfig({
    mode: form.reportConfig.mode,
    templateId: selectedTemplateId.value,
    sections: form.reportConfig.sections.map((section) => ({
      ...section,
      query: {
        ...section.query,
        listScope: { ...section.query.listScope },
        dueScope: section.query.dueScope ?? null
      },
      time: { ...section.time },
      group: { ...section.group },
      sort: { ...section.sort },
      render: {
        ...section.render,
        limit: section.render.limit || null
      }
    })),
    freeTemplate: {
      body: form.reportConfig.freeTemplate?.body ?? DEFAULT_FREE_TEMPLATE_BODY,
      syntaxVersion: 1
    }
  })
  return {
    id: editingId.value ?? undefined,
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
}

async function preview() {
  if (!form.name.trim()) {
    ElMessage.warning('请先填写汇总名称')
    return
  }
  templateError.value = ''
  if (form.reportConfig.mode === 'form') {
    const enabledSections = form.reportConfig.sections.filter((section) => section.enabled)
    if (!enabledSections.length) {
      ElMessage.warning('请至少启用一个报告区块')
      return
    }
  } else if (!form.reportConfig.freeTemplate.body.trim()) {
    ElMessage.warning('请填写自由模板内容')
    return
  }
  previewing.value = true
  try {
    const payload = toPlainScheduledSummaryDto(buildPayload())
    previewText.value = unwrapIpc(await window.api.scheduledSummaries.preview(payload))
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (/第 \d+ 行/.test(msg) || /自由模板|未知/.test(msg)) {
      templateError.value = msg
      previewText.value = ''
    }
  } finally {
    previewing.value = false
  }
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写汇总名称')
    return
  }
  templateError.value = ''
  if (form.reportConfig.mode === 'form') {
    const enabledSections = form.reportConfig.sections.filter((section) => section.enabled)
    if (!enabledSections.length) {
      ElMessage.warning('请至少启用一个报告区块')
      return
    }
    for (const section of enabledSections) {
      if (section.query.listScope.mode === 'only_list' && !section.query.listScope.listId) {
        ElMessage.warning(`区块「${section.title}」请选择清单`)
        return
      }
    }
  } else if (!form.reportConfig.freeTemplate.body.trim()) {
    ElMessage.warning('请填写自由模板内容')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (editingId.value) {
      await summaryStore.update(editingId.value, payload)
      ElMessage.success('汇总已更新')
    } else {
      await summaryStore.create(payload)
      ElMessage.success('汇总已创建')
    }
    await summaryStore.load()
    dialogOpen.value = false
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (/第 \d+ 行/.test(msg)) {
      templateError.value = msg
    }
  } finally {
    saving.value = false
  }
}

async function onRunNow(item: ScheduledSummary) {
  runningId.value = item.id
  try {
    await summaryStore.runNow(item.id)
    ElMessage.success('汇总已生成并发送到消息列表')
  } catch {
    /* store / unwrapIpc 已 Toast */
  } finally {
    runningId.value = null
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

.settings-section__mode-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
}

.free-template {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.free-template__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.free-template__help {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-bg, #f7f8fa);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.free-template__error {
  margin: 0;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.4;
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

.report-section__move {
  display: flex;
  gap: 4px;
}

.report-section__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.report-section__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.report-section__limit {
  margin-bottom: 0;
}

.preview-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.preview-box__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-box__text {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-bg, #f7f8fa);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

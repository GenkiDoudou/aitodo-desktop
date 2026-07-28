import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { nowIso } from '@shared/datetime'
import {
  DEFAULT_SUMMARY_PROMPT,
  normalizeSendTime,
  type CreateScheduledSummaryDto,
  type ScheduledSummary,
  type UpdateScheduledSummaryDto
} from '@shared/scheduled-summary'
import {
  buildReportSummaryText,
  localDayBounds,
  normalizeReportConfigV2,
  resolveSectionCategoryIds,
  resolveSectionTimeBounds
} from '@shared/summary-report-config'
import {
  assertValidSummaryFreeTemplate,
  renderSummaryFreeTemplate,
  SummaryTemplateError
} from '@shared/summary-free-template'
import { AppError } from '@shared/types'
import type { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import type { TaskRepository } from '../db/task-repository'
import type { CategoryRepository } from '../db/category-repository'
import type { SyncOutbox } from '../db/sync-outbox'
import { chatCompletion } from './llm-client'
import { readLlmConfig } from '../data-path'

function summarySyncPayload(summary: ScheduledSummary): Record<string, unknown> {
  return {
    id: summary.id,
    name: summary.name,
    categoryIds: summary.categoryIds,
    scheduleType: summary.scheduleType,
    sendTime: summary.sendTime,
    sendWeekday: summary.sendWeekday,
    sendDay: summary.sendDay,
    useLlm: summary.useLlm,
    promptText: summary.promptText,
    reportConfig: summary.reportConfig,
    enabled: summary.enabled,
    lastSentAt: summary.lastSentAt,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt
  }
}

export class ScheduledSummaryService {
  constructor(
    private readonly repo: ScheduledSummaryRepository,
    private readonly taskRepo: TaskRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly outbox?: SyncOutbox
  ) {}

  private withTx<T>(fn: () => T): T {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn()
  }

  private enqueueUpsert(summary: ScheduledSummary): void {
    this.outbox?.record({
      entityType: 'scheduled_summary',
      entityId: summary.id,
      operation: 'upsert',
      payload: summarySyncPayload(summary),
      clientSyncVersion: 1
    })
  }

  list(): ScheduledSummary[] {
    return this.repo.list()
  }

  get(id: string): ScheduledSummary {
    const item = this.repo.findById(id)
    if (!item) {
      throw new AppError('NOT_FOUND', '汇总任务不存在')
    }
    return item
  }

  create(dto: CreateScheduledSummaryDto): ScheduledSummary {
    const name = dto.name?.trim()
    if (!name) {
      throw new AppError('VALIDATION_ERROR', '汇总名称不能为空')
    }
    this.validateSchedule(dto.scheduleType, dto.sendTime, dto.sendWeekday, dto.sendDay)
    const reportConfig = normalizeReportConfigV2(dto.reportConfig)
    this.validateReportConfigForSave(reportConfig)

    const ts = nowIso()
    const summary: ScheduledSummary = {
      id: uuidv4(),
      name,
      categoryIds: dto.categoryIds ?? [],
      scheduleType: dto.scheduleType,
      sendTime: normalizeSendTime(dto.sendTime),
      sendWeekday: dto.scheduleType === 'weekly' ? (dto.sendWeekday ?? dayjs().day()) : null,
      sendDay: dto.scheduleType === 'monthly' ? (dto.sendDay ?? dayjs().date()) : null,
      useLlm: dto.useLlm ?? false,
      promptText: dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT,
      reportConfig,
      enabled: dto.enabled ?? true,
      lastSentAt: null,
      createdAt: ts,
      updatedAt: ts
    }
    this.withTx(() => {
      this.repo.insert(summary)
      this.enqueueUpsert(summary)
    })
    return summary
  }

  update(id: string, dto: UpdateScheduledSummaryDto): ScheduledSummary {
    const existing = this.get(id)
    const scheduleType = dto.scheduleType ?? existing.scheduleType
    const sendTime = normalizeSendTime(dto.sendTime ?? existing.sendTime)
    const sendWeekday =
      dto.sendWeekday !== undefined
        ? dto.sendWeekday
        : scheduleType === 'weekly'
          ? existing.sendWeekday
          : null
    const sendDay =
      dto.sendDay !== undefined
        ? dto.sendDay
        : scheduleType === 'monthly'
          ? existing.sendDay
          : null

    this.validateSchedule(scheduleType, sendTime, sendWeekday, sendDay)

    const reportConfig =
      dto.reportConfig !== undefined
        ? normalizeReportConfigV2(dto.reportConfig)
        : normalizeReportConfigV2(existing.reportConfig)
    this.validateReportConfigForSave(reportConfig)

    const updated: ScheduledSummary = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      categoryIds: dto.categoryIds ?? existing.categoryIds,
      scheduleType,
      sendTime,
      sendWeekday,
      sendDay,
      useLlm: dto.useLlm ?? existing.useLlm,
      promptText:
        dto.promptText !== undefined
          ? dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT
          : existing.promptText,
      reportConfig,
      enabled: dto.enabled ?? existing.enabled,
      updatedAt: nowIso()
    }
    if (!updated.name.trim()) {
      throw new AppError('VALIDATION_ERROR', '汇总名称不能为空')
    }
    this.withTx(() => {
      this.repo.update(updated)
      this.enqueueUpsert(updated)
    })
    return updated
  }

  delete(id: string): void {
    this.get(id)
    this.withTx(() => {
      this.repo.delete(id)
      this.outbox?.record({
        entityType: 'scheduled_summary',
        entityId: id,
        operation: 'delete',
        payload: { id, updatedAt: nowIso() },
        clientSyncVersion: 1
      })
    })
  }

  /** 生成并返回汇总正文（供调度器发送 / 预览） */
  async buildSummaryBody(summary: ScheduledSummary, now = dayjs()): Promise<string> {
    const reportConfig = normalizeReportConfigV2(summary.reportConfig)
    const raw =
      reportConfig.mode === 'template'
        ? this.buildTemplateBody(summary, reportConfig.freeTemplate.body, now)
        : this.buildFormBody(summary, reportConfig, now)

    if (!summary.useLlm) {
      return raw
    }

    try {
      const llmConfig = readLlmConfig()
      const prompt = summary.promptText?.trim() || DEFAULT_SUMMARY_PROMPT
      const userContent = `汇总名称：${summary.name}\n\n任务汇总数据：\n${raw}`
      return await chatCompletion(llmConfig, prompt, userContent)
    } catch (err) {
      console.error('[ScheduledSummaryService] LLM failed, fallback to raw', err)
      return `${raw}\n\n（大模型优化失败，已展示原始列表）`
    }
  }

  /**
   * 预览汇总正文：不落库、不 markSent、不发消息。
   */
  async previewSummaryBody(
    dto: Partial<ScheduledSummary> & {
      name?: string
      scheduleType?: ScheduledSummary['scheduleType']
      reportConfig?: ScheduledSummary['reportConfig']
    }
  ): Promise<string> {
    const existing = dto.id ? this.repo.findById(dto.id) : null
    const summary: ScheduledSummary = {
      id: existing?.id ?? 'preview',
      name: dto.name?.trim() || existing?.name || '预览汇总',
      categoryIds: dto.categoryIds ?? existing?.categoryIds ?? [],
      scheduleType: dto.scheduleType ?? existing?.scheduleType ?? 'daily',
      sendTime: normalizeSendTime(dto.sendTime ?? existing?.sendTime ?? '09:00'),
      sendWeekday: dto.sendWeekday !== undefined ? dto.sendWeekday : (existing?.sendWeekday ?? null),
      sendDay: dto.sendDay !== undefined ? dto.sendDay : (existing?.sendDay ?? null),
      useLlm: dto.useLlm ?? existing?.useLlm ?? false,
      promptText:
        dto.promptText !== undefined
          ? dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT
          : existing?.promptText ?? DEFAULT_SUMMARY_PROMPT,
      reportConfig: normalizeReportConfigV2(dto.reportConfig ?? existing?.reportConfig),
      enabled: true,
      lastSentAt: existing?.lastSentAt ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: existing?.updatedAt ?? nowIso()
    }
    return this.buildSummaryBody(summary)
  }

  markSent(id: string, sentAt: string): void {
    this.withTx(() => {
      this.repo.markSent(id, sentAt)
      const updated = this.repo.findById(id)
      if (updated) this.enqueueUpsert(updated)
    })
  }

  private buildFormBody(
    summary: ScheduledSummary,
    reportConfig: ReturnType<typeof normalizeReportConfigV2>,
    now: dayjs.Dayjs
  ): string {
    const enabledSections = reportConfig.sections.filter((section) => section.enabled)
    if (!enabledSections.length) {
      return '未启用任何汇总区块，请在设置中配置报告内容。'
    }

    const categories = this.categoryRepo.list()
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
    const todayBounds = localDayBounds(now)

    const sectionResults = enabledSections.map((section) => {
      const bounds = resolveSectionTimeBounds(
        section.time.preset,
        summary.scheduleType,
        now,
        summary.lastSentAt
      )
      const categoryIds = resolveSectionCategoryIds(section, summary.categoryIds)
      const tasks = this.taskRepo.listForSummaryReport(
        section.query.status,
        bounds.from,
        bounds.to,
        categoryIds,
        {
          dueBetween: section.query.dueScope === 'due_today_only' ? todayBounds : null
        }
      )
      return { section, bounds, tasks }
    })

    return buildReportSummaryText(sectionResults, categoryNames)
  }

  private buildTemplateBody(summary: ScheduledSummary, body: string, now: dayjs.Dayjs): string {
    if (!body.trim()) {
      throw new AppError('VALIDATION_ERROR', '自由模板内容为空')
    }
    const categories = this.categoryRepo.list()
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))
    const byId = new Map(categories.map((c) => [c.id, c]))

    try {
      return renderSummaryFreeTemplate(body, {
        scheduleType: summary.scheduleType,
        now,
        lastSentAt: summary.lastSentAt,
        categoryNames,
        resolveListId: ({ listName, listId, line }) => {
          if (listId) {
            if (!byId.has(listId)) {
              throw new SummaryTemplateError(line, `找不到清单 id「${listId}」`)
            }
            return listId
          }
          if (listName) {
            const hit = byName.get(listName.trim().toLowerCase())
            if (!hit) {
              throw new SummaryTemplateError(line, `找不到清单「${listName}」`)
            }
            return hit.id
          }
          // 未指定清单：可回落到汇总级 categoryIds
          return undefined
        },
        fetchTasks: ({ status, bounds, categoryIds, dueBetween }) => {
          const ids =
            categoryIds && categoryIds.length > 0
              ? categoryIds
              : summary.categoryIds.length > 0
                ? summary.categoryIds
                : undefined
          return this.taskRepo.listForSummaryReport(status, bounds.from, bounds.to, ids, {
            dueBetween: dueBetween ?? null
          })
        }
      })
    } catch (err) {
      if (err instanceof SummaryTemplateError) {
        throw new AppError('VALIDATION_ERROR', err.message)
      }
      throw err
    }
  }

  private validateReportConfigForSave(reportConfig: ReturnType<typeof normalizeReportConfigV2>): void {
    if (reportConfig.mode === 'template') {
      try {
        assertValidSummaryFreeTemplate(reportConfig.freeTemplate.body || '')
      } catch (err) {
        if (err instanceof SummaryTemplateError) {
          throw new AppError('VALIDATION_ERROR', err.message)
        }
        throw err
      }
      if (!reportConfig.freeTemplate.body.trim()) {
        throw new AppError('VALIDATION_ERROR', '自由模板内容不能为空')
      }
      return
    }
    const enabled = reportConfig.sections.filter((s) => s.enabled)
    if (!enabled.length) {
      throw new AppError('VALIDATION_ERROR', '请至少启用一个报告区块')
    }
  }

  private validateSchedule(
    scheduleType: ScheduledSummary['scheduleType'],
    sendTimeRaw: unknown,
    sendWeekday: number | null | undefined,
    sendDay: number | null | undefined
  ): void {
    const sendTime = normalizeSendTime(sendTimeRaw)
    if (!/^\d{2}:\d{2}$/.test(sendTime)) {
      throw new AppError('VALIDATION_ERROR', '发送时间格式应为 HH:mm')
    }
    if (scheduleType === 'weekly' && (sendWeekday == null || sendWeekday < 0 || sendWeekday > 6)) {
      throw new AppError('VALIDATION_ERROR', '每周汇总须选择星期')
    }
    if (scheduleType === 'monthly' && (sendDay == null || sendDay < 1 || sendDay > 31)) {
      throw new AppError('VALIDATION_ERROR', '每月汇总须选择日期（1–31）')
    }
  }
}

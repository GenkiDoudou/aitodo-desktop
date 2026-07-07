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
  normalizeReportConfig,
  resolveSectionTimeBounds
} from '@shared/summary-report-config'
import { AppError } from '@shared/types'
import type { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import type { TaskRepository } from '../db/task-repository'
import type { CategoryRepository } from '../db/category-repository'
import { chatCompletion } from './llm-client'
import { readLlmConfig } from '../data-path'

export class ScheduledSummaryService {
  constructor(
    private readonly repo: ScheduledSummaryRepository,
    private readonly taskRepo: TaskRepository,
    private readonly categoryRepo: CategoryRepository
  ) {}

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
      reportConfig: normalizeReportConfig(dto.reportConfig),
      enabled: dto.enabled ?? true,
      lastSentAt: null,
      createdAt: ts,
      updatedAt: ts
    }
    this.repo.insert(summary)
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
      reportConfig:
        dto.reportConfig !== undefined
          ? normalizeReportConfig(dto.reportConfig)
          : existing.reportConfig,
      enabled: dto.enabled ?? existing.enabled,
      updatedAt: nowIso()
    }
    if (!updated.name.trim()) {
      throw new AppError('VALIDATION_ERROR', '汇总名称不能为空')
    }
    this.repo.update(updated)
    return updated
  }

  delete(id: string): void {
    this.get(id)
    this.repo.delete(id)
  }

  /** 生成并返回汇总正文（供调度器发送） */
  async buildSummaryBody(summary: ScheduledSummary, now = dayjs()): Promise<string> {
    const categoryIds =
      summary.categoryIds.length > 0 ? summary.categoryIds : undefined
    const reportConfig = normalizeReportConfig(summary.reportConfig)
    const enabledSections = reportConfig.sections.filter((section) => section.enabled)

    if (!enabledSections.length) {
      return '未启用任何汇总区块，请在设置中配置报告内容。'
    }

    const categories = this.categoryRepo.list()
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]))

    const sectionResults = enabledSections.map((section) => {
      const bounds = resolveSectionTimeBounds(
        section.timeScope,
        summary.scheduleType,
        now,
        summary.lastSentAt
      )
      const tasks = this.taskRepo.listForSummaryReport(
        section.taskFilter,
        bounds.from,
        bounds.to,
        categoryIds
      )
      return { section, bounds, tasks }
    })

    const raw = buildReportSummaryText(sectionResults, categoryNames)
    const rangeHint = sectionResults
      .map(({ section, bounds }) => `${section.title}：${bounds.label}`)
      .join('；')

    if (!summary.useLlm) {
      return raw
    }

    try {
      const llmConfig = readLlmConfig()
      const prompt = summary.promptText?.trim() || DEFAULT_SUMMARY_PROMPT
      const userContent = `汇总名称：${summary.name}\n统计说明：${rangeHint}\n\n任务汇总数据：\n${raw}`
      return await chatCompletion(llmConfig, prompt, userContent)
    } catch (err) {
      console.error('[ScheduledSummaryService] LLM failed, fallback to raw', err)
      return `${raw}\n\n（大模型优化失败，已展示原始列表）`
    }
  }

  markSent(id: string, sentAt: string): void {
    this.repo.markSent(id, sentAt)
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

import dayjs from 'dayjs'
import { nowIso } from '@shared/datetime'
import { shouldSendSummaryNow } from '@shared/scheduled-summary'
import type { AppMessage } from '@shared/types'
import { AppError } from '@shared/types'
import type { ScheduledSummary } from '@shared/scheduled-summary'
import type { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import type { ScheduledSummaryService } from './scheduled-summary-service'
import type { AppMessageService } from './app-message-service'

const SCAN_INTERVAL_MS = 60_000

/**
 * 定时扫描汇总任务，到点生成汇总并推送应用内消息 + 系统通知。
 */
export class SummarySchedulerService {
  private timer: NodeJS.Timeout | null = null
  private ticking = false
  private readonly runningIds = new Set<string>()

  constructor(
    private readonly summaryRepo: ScheduledSummaryRepository,
    private readonly summaryService: ScheduledSummaryService,
    private readonly messageService: AppMessageService,
    private readonly onInAppMessage?: (message: AppMessage) => void
  ) {}

  start(): void {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), SCAN_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * 立即生成并发送一条汇总（写消息 + 系统通知 + 更新 lastSentAt）。
   * 不等待计划时刻；禁用的汇总也可手动触发。
   */
  async runNow(id: string): Promise<ScheduledSummary> {
    if (this.runningIds.has(id)) {
      throw new AppError('VALIDATION_ERROR', '该汇总正在生成中，请稍候')
    }
    const summary = this.summaryRepo.findById(id)
    if (!summary) {
      throw new AppError('NOT_FOUND', '汇总任务不存在')
    }

    this.runningIds.add(id)
    try {
      await this.dispatch(summary, dayjs())
      const updated = this.summaryRepo.findById(id)
      if (!updated) {
        throw new AppError('NOT_FOUND', '汇总任务不存在')
      }
      return updated
    } finally {
      this.runningIds.delete(id)
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const now = dayjs()
      for (const summary of this.summaryRepo.list()) {
        if (!shouldSendSummaryNow(summary, now)) continue
        if (this.runningIds.has(summary.id)) continue

        this.runningIds.add(summary.id)
        try {
          await this.dispatch(summary, now)
        } catch (err) {
          console.error('[SummarySchedulerService] send failed', summary.id, err)
        } finally {
          this.runningIds.delete(summary.id)
        }
      }
    } finally {
      this.ticking = false
    }
  }

  private async dispatch(summary: ScheduledSummary, now: dayjs.Dayjs): Promise<void> {
    const body = await this.summaryService.buildSummaryBody(summary, now)
    const inApp = this.messageService.create({
      kind: 'notification',
      title: `定时汇总：${summary.name}`,
      body,
      taskId: null,
      source: 'scheduled_summary'
    })
    this.onInAppMessage?.(inApp)
    this.summaryService.markSent(summary.id, nowIso())
  }
}

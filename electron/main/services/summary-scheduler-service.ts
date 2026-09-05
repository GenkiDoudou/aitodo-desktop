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
 * 已登录（有 accessToken）时本机不执行自动 tick 发送，到点外发改由服务端调度；
 * runNow 仍可用且不占用自动 lastSentAt。
 */
export class SummarySchedulerService {
  private timer: NodeJS.Timeout | null = null
  private ticking = false
  // 防并发：同一个 summary 在同一时刻只能生成/发送一次。
  private readonly runningIds = new Set<string>()

  constructor(
    private readonly summaryRepo: ScheduledSummaryRepository,
    private readonly summaryService: ScheduledSummaryService,
    private readonly messageService: AppMessageService,
    private readonly onInAppMessage?: (message: AppMessage) => void,
    /** 返回 true 表示已登录：自动 tick 空转 */
    private readonly isLoggedIn?: () => boolean
  ) {}

  start(): void {
    if (this.timer) return
    // 启动后立即触发一次 tick，之后按 SCAN_INTERVAL_MS 扫描是否到点。
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
   * 立即生成并发送一条汇总（写消息 + 通知外发）。
   * 不更新 lastSentAt，避免占用自动到点名额。
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
      // runNow：
      // - 生成正文并写 in-app 消息（以及系统通知外发）；
      // - 不写 lastSentAt，因此不会影响当天/本周期自动门禁逻辑。
      await this.dispatch(summary, dayjs(), { updateLastSentAt: false })
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
    // 登录态：自动到点仅由服务端负责，本机不写汇总消息、不外发。
    if (this.isLoggedIn?.()) return
    if (this.ticking) return
    this.ticking = true
    try {
      const now = dayjs()
      for (const summary of this.summaryRepo.list()) {
        // shouldSendSummaryNow 决定是否满足周期门禁（daily/weekly/monthly + lastSentAt）。
        if (!shouldSendSummaryNow(summary, now)) continue
        if (this.runningIds.has(summary.id)) continue

        this.runningIds.add(summary.id)
        try {
          // tick 自动发送：
          // - 成功后写 lastSentAt，让同一周期不重复发送。
          await this.dispatch(summary, now, { updateLastSentAt: true })
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

  private async dispatch(
    summary: ScheduledSummary,
    now: dayjs.Dayjs,
    opts: { updateLastSentAt: boolean }
  ): Promise<void> {
    const body = await this.summaryService.buildSummaryBody(summary, now)
    const inApp = this.messageService.create({
      kind: 'notification',
      title: `定时汇总：${summary.name}`,
      body,
      taskId: null,
      source: 'scheduled_summary'
    })
    this.onInAppMessage?.(inApp)
    if (opts.updateLastSentAt) {
      this.summaryService.markSent(summary.id, nowIso())
    }
  }
}

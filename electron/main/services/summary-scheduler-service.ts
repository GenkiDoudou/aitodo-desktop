import dayjs from 'dayjs'
import { nowIso } from '@shared/datetime'
import { shouldSendSummaryNow } from '@shared/scheduled-summary'
import type { AppMessage } from '@shared/types'
import type { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import type { ScheduledSummaryService } from './scheduled-summary-service'
import type { AppMessageService } from './app-message-service'
import { showSystemNotification } from './system-notification'

const SCAN_INTERVAL_MS = 60_000

/**
 * 定时扫描汇总任务，到点生成汇总并推送应用内消息 + 系统通知。
 */
export class SummarySchedulerService {
  private timer: NodeJS.Timeout | null = null
  private ticking = false

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

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const now = dayjs()
      for (const summary of this.summaryRepo.list()) {
        if (!shouldSendSummaryNow(summary, now)) continue

        try {
          const body = await this.summaryService.buildSummaryBody(summary, now)
          const inApp = this.messageService.create({
            kind: 'notification',
            title: `定时汇总：${summary.name}`,
            body,
            taskId: null,
            source: 'scheduled_summary'
          })
          this.onInAppMessage?.(inApp)
          showSystemNotification(summary.name, body.slice(0, 240))
          this.summaryService.markSent(summary.id, nowIso())
        } catch (err) {
          console.error('[SummarySchedulerService] send failed', summary.id, err)
        }
      }
    } finally {
      this.ticking = false
    }
  }
}

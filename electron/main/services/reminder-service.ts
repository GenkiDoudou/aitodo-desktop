import { Notification } from 'electron'
import { nowIso } from '@shared/datetime'
import type { TaskRepository } from '../db/task-repository'

const SCAN_INTERVAL_MS = 60_000

/**
 * 主进程定时扫描 remind_at，触发系统通知。
 * 同一任务仅提醒一次：触发前先写入 remind_fired_at，并监听 close/click 防重复。
 */
export class ReminderService {
  private timer: NodeJS.Timeout | null = null
  /** 本轮已排队展示的任务，防止 60s 内重复弹窗 */
  private readonly pendingIds = new Set<string>()

  constructor(private readonly taskRepo: TaskRepository) {}

  start(): void {
    if (this.timer) {
      return
    }
    this.tick()
    this.timer = setInterval(() => this.tick(), SCAN_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.pendingIds.clear()
  }

  private markFired(taskId: string, firedAt: string): void {
    if (this.pendingIds.has(taskId)) {
      return
    }
    this.pendingIds.add(taskId)
    this.taskRepo.markRemindFired(taskId, firedAt)
  }

  private tick(): void {
    if (!Notification.isSupported()) {
      return
    }
    const now = nowIso()
    const due = this.taskRepo.findDueReminders(now)
    for (const task of due) {
      if (this.pendingIds.has(task.id)) {
        continue
      }
      // 先落库再弹窗，避免下一轮扫描重复提醒
      this.markFired(task.id, now)

      const notification = new Notification({
        title: '任务提醒',
        body: task.title
      })
      notification.on('close', () => {
        this.pendingIds.delete(task.id)
      })
      notification.on('click', () => {
        this.pendingIds.delete(task.id)
      })
      notification.on('failed', () => {
        this.pendingIds.delete(task.id)
      })
      notification.show()
    }
  }
}

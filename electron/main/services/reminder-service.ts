import { nowIso } from '@shared/datetime'
import { nextDueAfterRecurrence, remindAtFromDueOffset } from '@shared/task-reminder'
import type { AppMessage } from '@shared/types'
import type { TaskRepository } from '../db/task-repository'
import type { TaskReminderRepository } from '../db/task-reminder-repository'
import type { AppMessageService } from './app-message-service'
import type { HolidayService } from './holiday-service'
import { showSystemNotification } from './system-notification'

const SCAN_INTERVAL_MS = 60_000

/**
 * 主进程定时扫描 task_reminders，触发系统通知与应用内消息。
 * 支持持续提醒与循环（触发后推进 dueAt 并重算相对提醒）。
 * 法定节假日循环依赖 HolidayService（timor.tech API + 本地缓存）。
 */
export class ReminderService {
  private timer: NodeJS.Timeout | null = null
  private readonly pendingIds = new Set<string>()
  private ticking = false

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly reminderRepo: TaskReminderRepository,
    private readonly messageService: AppMessageService,
    private readonly holidayService: HolidayService,
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
    this.pendingIds.clear()
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const now = nowIso()
      const due = this.reminderRepo.findDue(now)
      for (const reminder of due) {
        if (this.pendingIds.has(reminder.id)) continue
        this.pendingIds.add(reminder.id)

        const task = this.taskRepo.findById(reminder.taskId)
        if (!task) {
          this.pendingIds.delete(reminder.id)
          continue
        }

        const inApp = this.messageService.createTaskReminder({
          ...task,
          title: task.title,
          id: task.id
        } as import('@shared/types').Task)
        this.onInAppMessage?.(inApp)

        // 先弹系统通知，避免后续循环/DB 更新异常导致无 Toast
        showSystemNotification('任务提醒', task.title)

        const continuous = task.remindContinuous
        const recurrence = task.recurrence

        if (!continuous) {
          this.reminderRepo.markFired(reminder.id, now)
        }

        if (recurrence && task.dueAt) {
          const nextDue = await this.resolveNextDue(task.dueAt, recurrence)
          if (nextDue) {
            const updated = {
              ...task,
              dueAt: nextDue,
              remindAt:
                reminder.offsetMinutes != null
                  ? remindAtFromDueOffset(nextDue, reminder.offsetMinutes)
                  : task.remindAt,
              updatedAt: now
            }
            this.taskRepo.update(updated)
            this.reminderRepo.rebuildOffsetsForTask(task.id, nextDue)
            if (continuous) {
              this.reminderRepo.clearFiredForTask(task.id)
            }
          }
        }

        this.pendingIds.delete(reminder.id)
      }
    } finally {
      this.ticking = false
    }
  }

  private async resolveNextDue(
    dueAt: string,
    recurrence: NonNullable<import('@shared/types').Task['recurrence']>
  ): Promise<string | null> {
    if (recurrence.type === 'legal_holidays') {
      try {
        return await this.holidayService.nextLegalHolidayDueAfter(dueAt)
      } catch (err) {
        console.error('[ReminderService] 法定节假日数据获取失败', err)
        return null
      }
    }
    return nextDueAfterRecurrence(dueAt, recurrence)
  }
}

import type Database from 'better-sqlite3'
import type { PendingNotifyItem } from '@shared/notification-config'
import { shouldSendSummaryNow } from '@shared/scheduled-summary'
import dayjs from 'dayjs'
import { TaskRepository } from '../db/task-repository'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { readDeferredNotifies } from '../db/notification-deferred-store'

/**
 * 本机「待发送」视图数据源（不依赖登录）。
 *
 * 三类：
 * 1) upcoming 任务提醒：remindAt 仍在未来；
 * 2) upcoming 定时汇总：今日/本周期尚未到点（且 shouldSendSummaryNow 为 false）；
 * 3) deferred：免打扰延后队列（deferredTo 到达后由 NotifyRuntime.flushDeferred 冲刷）。
 *
 * 仅用于 UI 展示，不改变真实调度逻辑。
 */
export function listLocalPending(db: Database.Database, dataDir: string): PendingNotifyItem[] {
  const out: PendingNotifyItem[] = []
  const now = dayjs()

  for (const t of new TaskRepository(db).list({})) {
    if (!t.remindAt || t.deletedAt) continue
    const due = dayjs(t.remindAt)
    if (!due.isValid()) continue
    if (due.isAfter(now)) {
      out.push({
        id: `local-upcoming-task-${t.id}`,
        kind: 'upcoming',
        event: 'task_reminder',
        entityId: t.id,
        title: t.title,
        bodyPreview: t.description ?? t.title,
        fireAt: due.toISOString(),
        deferredTo: null,
        source: 'local'
      })
    }
  }

  for (const s of new ScheduledSummaryRepository(db).list()) {
    if (!s.enabled) continue
    // 已到点可发的汇总不进入「即将」列表（留给调度器真实发送）。
    if (shouldSendSummaryNow(s, now)) continue
    const [hh, mm] = s.sendTime.split(':').map(Number)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
    let next = now.hour(hh).minute(mm).second(0).millisecond(0)
    if (s.scheduleType === 'weekly') {
      if (s.sendWeekday == null || now.day() !== s.sendWeekday) continue
    }
    if (s.scheduleType === 'monthly') {
      if (s.sendDay == null || now.date() !== s.sendDay) continue
    }
    if (!next.isAfter(now)) continue
    out.push({
      id: `local-upcoming-summary-${s.id}`,
      kind: 'upcoming',
      event: 'scheduled_summary',
      entityId: s.id,
      title: s.name,
      bodyPreview: s.name,
      fireAt: next.toISOString(),
      deferredTo: null,
      source: 'local'
    })
  }

  for (const d of readDeferredNotifies(dataDir)) {
    out.push({
      id: `local-deferred-${d.id}`,
      kind: 'deferred',
      event: d.event,
      entityId: d.entityId,
      title: d.title,
      bodyPreview: d.body,
      fireAt: d.fireAt,
      deferredTo: d.deferredTo,
      source: 'local'
    })
  }

  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt))
}

/**
 * 合并本机 + 服务端 pending。
 *
 * 去重键：event|entityId|fireAt。
 * 同键时后写入的 server 项会覆盖 local（已登录时优先展示服务端队列态）。
 */
export function mergePendingLists(
  local: PendingNotifyItem[],
  server: PendingNotifyItem[]
): PendingNotifyItem[] {
  const map = new Map<string, PendingNotifyItem>()
  for (const item of local) {
    map.set(`${item.event}|${item.entityId}|${item.fireAt}`, item)
  }
  for (const item of server) {
    map.set(`${item.event}|${item.entityId}|${item.fireAt}`, item)
  }
  return [...map.values()].sort((a, b) => a.fireAt.localeCompare(b.fireAt))
}

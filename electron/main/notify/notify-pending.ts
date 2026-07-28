import type Database from 'better-sqlite3'
import type { PendingNotifyItem } from '@shared/notification-config'
import { shouldSendSummaryNow } from '@shared/scheduled-summary'
import dayjs from 'dayjs'
import { TaskRepository } from '../db/task-repository'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { readDeferredNotifies } from '../db/notification-deferred-store'

/** 本机即将触发 + 免打扰延后 */
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

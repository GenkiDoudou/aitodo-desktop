import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NotifyEvent } from '@shared/notification-config'

const DEFERRED_FILE = 'notification-deferred.json'

export interface DeferredNotifyItem {
  id: string
  event: NotifyEvent
  entityId: string
  title: string
  body: string
  /** 原计划触发时间（幂等） */
  fireAt: string
  deferredTo: string
}

export function readDeferredNotifies(dataDir: string): DeferredNotifyItem[] {
  const path = join(dataDir, DEFERRED_FILE)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return Array.isArray(raw) ? (raw as DeferredNotifyItem[]) : []
  } catch {
    return []
  }
}

export function writeDeferredNotifies(dataDir: string, items: DeferredNotifyItem[]): void {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, DEFERRED_FILE), JSON.stringify(items, null, 2), 'utf8')
}

export function upsertDeferredNotify(dataDir: string, item: DeferredNotifyItem): void {
  const prev = readDeferredNotifies(dataDir)
  const key = `${item.event}|${item.entityId}|${item.fireAt}`
  const next = prev.filter((x) => `${x.event}|${x.entityId}|${x.fireAt}` !== key)
  next.push(item)
  writeDeferredNotifies(dataDir, next)
}

export function removeDeferredNotify(
  dataDir: string,
  event: NotifyEvent,
  entityId: string,
  fireAt: string
): void {
  const key = `${event}|${entityId}|${fireAt}`
  writeDeferredNotifies(
    dataDir,
    readDeferredNotifies(dataDir).filter((x) => `${x.event}|${x.entityId}|${x.fireAt}` !== key)
  )
}

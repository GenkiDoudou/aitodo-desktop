import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mergeNotificationConfig,
  type NotificationConfig,
  type NotifyDeliveryRecord
} from '@shared/notification-config'

const CONFIG_FILE = 'notification-config.json'
const LOCAL_LOG_FILE = 'notification-delivery-local.json'
const LOCAL_LOG_MAX = 50

export function readNotificationConfig(dataDir: string): NotificationConfig {
  const path = join(dataDir, CONFIG_FILE)
  if (!existsSync(path)) return mergeNotificationConfig()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<NotificationConfig>
    return mergeNotificationConfig(raw)
  } catch {
    return mergeNotificationConfig()
  }
}

export function writeNotificationConfig(
  dataDir: string,
  config: NotificationConfig
): NotificationConfig {
  const merged = mergeNotificationConfig(config)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, CONFIG_FILE), JSON.stringify(merged, null, 2), 'utf8')
  return merged
}

export function readLocalDeliveryLog(dataDir: string): NotifyDeliveryRecord[] {
  const path = join(dataDir, LOCAL_LOG_FILE)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return Array.isArray(raw) ? (raw as NotifyDeliveryRecord[]) : []
  } catch {
    return []
  }
}

export function appendLocalDeliveryLog(
  dataDir: string,
  record: NotifyDeliveryRecord
): NotifyDeliveryRecord[] {
  const prev = readLocalDeliveryLog(dataDir)
  const next = [record, ...prev].slice(0, LOCAL_LOG_MAX)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, LOCAL_LOG_FILE), JSON.stringify(next, null, 2), 'utf8')
  return next
}

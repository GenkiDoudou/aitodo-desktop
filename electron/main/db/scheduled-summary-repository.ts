import type Database from 'better-sqlite3'
import type { ScheduledSummary } from '@shared/scheduled-summary'
import { normalizeReportConfig } from '@shared/summary-report-config'

interface Row {
  id: string
  name: string
  category_ids: string
  schedule_type: string
  send_time: string
  send_weekday: number | null
  send_day: number | null
  use_llm: number
  prompt_text: string | null
  report_config: string | null
  enabled: number
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

function parseReportConfig(raw: string | null) {
  if (!raw) {
    return normalizeReportConfig(null)
  }
  try {
    return normalizeReportConfig(JSON.parse(raw))
  } catch {
    return normalizeReportConfig(null)
  }
}

function mapRow(row: Row): ScheduledSummary {
  let categoryIds: string[] = []
  try {
    categoryIds = JSON.parse(row.category_ids) as string[]
    if (!Array.isArray(categoryIds)) categoryIds = []
  } catch {
    categoryIds = []
  }
  return {
    id: row.id,
    name: row.name,
    categoryIds,
    scheduleType: row.schedule_type as ScheduledSummary['scheduleType'],
    sendTime: row.send_time,
    sendWeekday: row.send_weekday,
    sendDay: row.send_day,
    useLlm: row.use_llm === 1,
    promptText: row.prompt_text,
    reportConfig: parseReportConfig(row.report_config),
    enabled: row.enabled === 1,
    lastSentAt: row.last_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ScheduledSummaryRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ScheduledSummary[] {
    const rows = this.db
      .prepare(`SELECT * FROM scheduled_summaries ORDER BY created_at ASC`)
      .all() as Row[]
    return rows.map(mapRow)
  }

  findById(id: string): ScheduledSummary | null {
    const row = this.db.prepare(`SELECT * FROM scheduled_summaries WHERE id = ?`).get(id) as
      | Row
      | undefined
    return row ? mapRow(row) : null
  }

  insert(summary: ScheduledSummary): void {
    this.db
      .prepare(
        `INSERT INTO scheduled_summaries (
          id, name, category_ids, schedule_type, send_time, send_weekday, send_day,
          use_llm, prompt_text, report_config, enabled, last_sent_at, created_at, updated_at
        ) VALUES (
          @id, @name, @categoryIds, @scheduleType, @sendTime, @sendWeekday, @sendDay,
          @useLlm, @promptText, @reportConfig, @enabled, @lastSentAt, @createdAt, @updatedAt
        )`
      )
      .run({
        id: summary.id,
        name: summary.name,
        categoryIds: JSON.stringify(summary.categoryIds),
        scheduleType: summary.scheduleType,
        sendTime: summary.sendTime,
        sendWeekday: summary.sendWeekday,
        sendDay: summary.sendDay,
        useLlm: summary.useLlm ? 1 : 0,
        promptText: summary.promptText,
        reportConfig: JSON.stringify(summary.reportConfig),
        enabled: summary.enabled ? 1 : 0,
        lastSentAt: summary.lastSentAt,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt
      })
  }

  update(summary: ScheduledSummary): void {
    this.db
      .prepare(
        `UPDATE scheduled_summaries SET
          name = @name,
          category_ids = @categoryIds,
          schedule_type = @scheduleType,
          send_time = @sendTime,
          send_weekday = @sendWeekday,
          send_day = @sendDay,
          use_llm = @useLlm,
          prompt_text = @promptText,
          report_config = @reportConfig,
          enabled = @enabled,
          last_sent_at = @lastSentAt,
          updated_at = @updatedAt
        WHERE id = @id`
      )
      .run({
        id: summary.id,
        name: summary.name,
        categoryIds: JSON.stringify(summary.categoryIds),
        scheduleType: summary.scheduleType,
        sendTime: summary.sendTime,
        sendWeekday: summary.sendWeekday,
        sendDay: summary.sendDay,
        useLlm: summary.useLlm ? 1 : 0,
        promptText: summary.promptText,
        reportConfig: JSON.stringify(summary.reportConfig),
        enabled: summary.enabled ? 1 : 0,
        lastSentAt: summary.lastSentAt,
        updatedAt: summary.updatedAt
      })
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM scheduled_summaries WHERE id = ?`).run(id)
  }

  markSent(id: string, sentAt: string): void {
    this.db
      .prepare(`UPDATE scheduled_summaries SET last_sent_at = ?, updated_at = ? WHERE id = ?`)
      .run(sentAt, sentAt, id)
  }
}

import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import type {
  CreateWidgetNoteDto,
  UpdateWidgetNoteDto,
  UpdateWidgetSettingsDto,
  WidgetNote,
  WidgetNoteColor,
  WidgetSettings
} from '@shared/widget-notes'
import { sortWidgetNotes, WIDGET_NOTE_COLORS } from '@shared/widget-notes'
import { AppError } from '@shared/types'

interface WidgetSettingsRow {
  id: string
  x: number
  y: number
  width: number
  height: number
  always_on_top: number
  open_on_startup: number
  last_tab: string
  updated_at: string
}

interface WidgetNoteRow {
  id: string
  content: string
  color: string
  pinned: number
  created_at: string
  updated_at: string
}

const SETTINGS_ID = 'default'

function mapSettings(row: WidgetSettingsRow): WidgetSettings {
  return {
    id: row.id,
    openOnStartup: row.open_on_startup === 1,
    updatedAt: row.updated_at
  }
}

function mapNote(row: WidgetNoteRow): WidgetNote {
  const color = WIDGET_NOTE_COLORS.includes(row.color as WidgetNoteColor)
    ? (row.color as WidgetNoteColor)
    : 'yellow'
  return {
    id: row.id,
    content: row.content,
    color,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class WidgetNoteRepository {
  constructor(private readonly db: Database.Database) {}

  getSettings(): WidgetSettings {
    const row = this.db
      .prepare(`SELECT * FROM widget_settings WHERE id = ?`)
      .get(SETTINGS_ID) as WidgetSettingsRow | undefined
    if (!row) {
      throw new AppError('INTERNAL', '挂件设置未初始化')
    }
    return mapSettings(row)
  }

  updateSettings(dto: UpdateWidgetSettingsDto): WidgetSettings {
    const current = this.getSettings()
    const ts = nowIso()
    const next = {
      openOnStartup: dto.openOnStartup ?? current.openOnStartup,
      updatedAt: ts
    }
    this.db
      .prepare(
        `UPDATE widget_settings SET open_on_startup = @openOnStartup, updated_at = @updatedAt WHERE id = @id`
      )
      .run({
        id: SETTINGS_ID,
        openOnStartup: next.openOnStartup ? 1 : 0,
        updatedAt: ts
      })
    return { id: SETTINGS_ID, ...next }
  }

  listNotes(): WidgetNote[] {
    const rows = this.db.prepare(`SELECT * FROM widget_notes`).all() as WidgetNoteRow[]
    return sortWidgetNotes(rows.map(mapNote))
  }

  findNote(id: string): WidgetNote | null {
    const row = this.db.prepare(`SELECT * FROM widget_notes WHERE id = ?`).get(id) as
      | WidgetNoteRow
      | undefined
    return row ? mapNote(row) : null
  }

  createNote(dto: CreateWidgetNoteDto = {}): WidgetNote {
    const ts = nowIso()
    const id = uuidv4()
    const color =
      dto.color && WIDGET_NOTE_COLORS.includes(dto.color) ? dto.color : 'yellow'
    const content = dto.content ?? ''
    this.db
      .prepare(
        `INSERT INTO widget_notes (id, content, color, pinned, created_at, updated_at)
         VALUES (@id, @content, @color, 0, @createdAt, @updatedAt)`
      )
      .run({ id, content, color, createdAt: ts, updatedAt: ts })
    return {
      id,
      content,
      color,
      pinned: false,
      createdAt: ts,
      updatedAt: ts
    }
  }

  updateNote(id: string, dto: UpdateWidgetNoteDto): WidgetNote {
    const current = this.findNote(id)
    if (!current) {
      throw new AppError('NOT_FOUND', '便签不存在')
    }
    const ts = nowIso()
    const next: WidgetNote = {
      ...current,
      content: dto.content ?? current.content,
      color:
        dto.color && WIDGET_NOTE_COLORS.includes(dto.color) ? dto.color : current.color,
      pinned: dto.pinned ?? current.pinned,
      updatedAt: ts
    }
    this.db
      .prepare(
        `UPDATE widget_notes SET content = @content, color = @color, pinned = @pinned, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        content: next.content,
        color: next.color,
        pinned: next.pinned ? 1 : 0,
        updatedAt: ts
      })
    return next
  }

  deleteNote(id: string): void {
    const result = this.db.prepare(`DELETE FROM widget_notes WHERE id = ?`).run(id)
    if (result.changes === 0) {
      throw new AppError('NOT_FOUND', '便签不存在')
    }
  }

  /** 远程同步写入：保留服务端时间戳 */
  upsertFromSync(note: WidgetNote): void {
    const color = WIDGET_NOTE_COLORS.includes(note.color) ? note.color : 'yellow'
    const existing = this.findNote(note.id)
    if (existing) {
      this.db
        .prepare(
          `UPDATE widget_notes SET content = @content, color = @color, pinned = @pinned,
           created_at = @createdAt, updated_at = @updatedAt WHERE id = @id`
        )
        .run({
          id: note.id,
          content: note.content,
          color,
          pinned: note.pinned ? 1 : 0,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
        })
      return
    }
    this.db
      .prepare(
        `INSERT INTO widget_notes (id, content, color, pinned, created_at, updated_at)
         VALUES (@id, @content, @color, @pinned, @createdAt, @updatedAt)`
      )
      .run({
        id: note.id,
        content: note.content,
        color,
        pinned: note.pinned ? 1 : 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })
  }

  deleteIfExists(id: string): void {
    this.db.prepare(`DELETE FROM widget_notes WHERE id = ?`).run(id)
  }
}

import type Database from 'better-sqlite3'
import type {
  DesktopCategory,
  DesktopCategoryRule,
  DesktopOrganizeSettings
} from '@shared/desktop-organize-types'
import type { DesktopCustomRule } from '@shared/desktop-custom-rules'

interface SettingsRow {
  folder_prefix: string
  layout_mode: string
  auto_organize_on_scan: number
  auto_scan_on_boot: number
  auto_organize_on_boot?: number
  auto_organize_on_new_icons?: number
  updated_at: string
}

interface CategoryRow {
  id: string
  name: string
  target_folder_name: string
  icon: string
  color: string
  sort_order: number
  enabled: number
  is_system: number
  created_at: string
  updated_at: string
}

interface RuleRow {
  id: string
  category_id: string
  rule_type: string
  rule_json: string
  sort_order: number
}

interface CustomRuleRow {
  id: string
  name: string
  enabled: number
  match_type: string
  match_value: string
  category_id: string
  sort_order: number
  created_at: string
  updated_at: string
}

interface SnapshotRow {
  id: string
  payload_json: string
  created_at: string
}

export interface OrganizeSnapshotPayload {
  moves: Array<{ from: string; to: string }>
}

function parseRule(json: string): DesktopCategoryRule {
  return JSON.parse(json) as DesktopCategoryRule
}

function mapSettings(row: SettingsRow): DesktopOrganizeSettings {
  return {
    folderPrefix: row.folder_prefix,
    layoutMode: 'flat_prefix',
    autoOrganizeOnScan: row.auto_organize_on_scan === 1,
    autoScanOnBoot: row.auto_scan_on_boot === 1,
    autoOrganizeOnBoot: row.auto_organize_on_boot === 1,
    autoOrganizeOnNewIcons: row.auto_organize_on_new_icons === 1,
    updatedAt: row.updated_at
  }
}

function mapCustomRule(row: CustomRuleRow): DesktopCustomRule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    matchType: row.match_type as DesktopCustomRule['matchType'],
    matchValue: row.match_value,
    categoryId: row.category_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapCategory(row: CategoryRow, rules: DesktopCategoryRule[]): DesktopCategory {
  return {
    id: row.id,
    name: row.name,
    targetFolderName: row.target_folder_name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    isSystem: row.is_system === 1,
    rules,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class DesktopOrganizeRepository {
  constructor(private readonly db: Database.Database) {}

  getSettings(): DesktopOrganizeSettings {
    const row = this.db
      .prepare(
        `SELECT folder_prefix, layout_mode, auto_organize_on_scan, auto_scan_on_boot,
                auto_organize_on_boot, auto_organize_on_new_icons, updated_at
         FROM desktop_organize_settings WHERE id = 'default'`
      )
      .get() as SettingsRow | undefined
    if (!row) {
      throw new Error('desktop_organize_settings 未初始化')
    }
    return mapSettings(row)
  }

  updateSettings(
    fields: Partial<
      Pick<
        DesktopOrganizeSettings,
        | 'folderPrefix'
        | 'autoOrganizeOnScan'
        | 'autoScanOnBoot'
        | 'autoOrganizeOnBoot'
        | 'autoOrganizeOnNewIcons'
      >
    >,
    updatedAt: string
  ): DesktopOrganizeSettings {
    const existing = this.getSettings()
    this.db
      .prepare(
        `UPDATE desktop_organize_settings SET
          folder_prefix = @folderPrefix,
          auto_organize_on_scan = @autoOrganizeOnScan,
          auto_scan_on_boot = @autoScanOnBoot,
          auto_organize_on_boot = @autoOrganizeOnBoot,
          auto_organize_on_new_icons = @autoOrganizeOnNewIcons,
          updated_at = @updatedAt
         WHERE id = 'default'`
      )
      .run({
        folderPrefix: fields.folderPrefix ?? existing.folderPrefix,
        autoOrganizeOnScan: (fields.autoOrganizeOnScan ?? existing.autoOrganizeOnScan) ? 1 : 0,
        autoScanOnBoot: (fields.autoScanOnBoot ?? existing.autoScanOnBoot) ? 1 : 0,
        autoOrganizeOnBoot: (fields.autoOrganizeOnBoot ?? existing.autoOrganizeOnBoot) ? 1 : 0,
        autoOrganizeOnNewIcons: (fields.autoOrganizeOnNewIcons ?? existing.autoOrganizeOnNewIcons)
          ? 1
          : 0,
        updatedAt
      })
    return this.getSettings()
  }

  listCategories(): DesktopCategory[] {
    const rows = this.db
      .prepare(`SELECT * FROM desktop_categories ORDER BY sort_order ASC, created_at ASC`)
      .all() as CategoryRow[]
    const ruleRows = this.db
      .prepare(`SELECT * FROM desktop_category_rules ORDER BY sort_order ASC`)
      .all() as RuleRow[]
    const rulesByCat = new Map<string, DesktopCategoryRule[]>()
    for (const r of ruleRows) {
      const list = rulesByCat.get(r.category_id) ?? []
      list.push(parseRule(r.rule_json))
      rulesByCat.set(r.category_id, list)
    }
    return rows.map((row) => mapCategory(row, rulesByCat.get(row.id) ?? []))
  }

  findCategoryById(id: string): DesktopCategory | null {
    const row = this.db.prepare(`SELECT * FROM desktop_categories WHERE id = ?`).get(id) as
      | CategoryRow
      | undefined
    if (!row) return null
    const ruleRows = this.db
      .prepare(`SELECT * FROM desktop_category_rules WHERE category_id = ? ORDER BY sort_order ASC`)
      .all(id) as RuleRow[]
    return mapCategory(
      row,
      ruleRows.map((r) => parseRule(r.rule_json))
    )
  }

  insertCategory(
    category: DesktopCategory,
    ruleRows: Array<{ id: string; rule: DesktopCategoryRule; sortOrder: number }>
  ): void {
    this.db
      .prepare(
        `INSERT INTO desktop_categories (id, name, target_folder_name, icon, color, sort_order, enabled, is_system, created_at, updated_at)
         VALUES (@id, @name, @targetFolderName, @icon, @color, @sortOrder, @enabled, @isSystem, @createdAt, @updatedAt)`
      )
      .run({
        id: category.id,
        name: category.name,
        targetFolderName: category.targetFolderName,
        icon: category.icon,
        color: category.color,
        sortOrder: category.sortOrder,
        enabled: category.enabled ? 1 : 0,
        isSystem: category.isSystem ? 1 : 0,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      })
    const insertRule = this.db.prepare(
      `INSERT INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES (@id, @categoryId, @ruleType, @ruleJson, @sortOrder)`
    )
    for (const r of ruleRows) {
      insertRule.run({
        id: r.id,
        categoryId: category.id,
        ruleType: r.rule.type,
        ruleJson: JSON.stringify(r.rule),
        sortOrder: r.sortOrder
      })
    }
  }

  updateCategory(
    id: string,
    fields: Partial<
      Pick<DesktopCategory, 'name' | 'targetFolderName' | 'icon' | 'color' | 'sortOrder' | 'enabled' | 'updatedAt'>
    >,
    rules?: DesktopCategoryRule[]
  ): void {
    const existing = this.findCategoryById(id)
    if (!existing) return
    this.db
      .prepare(
        `UPDATE desktop_categories SET
          name = @name,
          target_folder_name = @targetFolderName,
          icon = @icon,
          color = @color,
          sort_order = @sortOrder,
          enabled = @enabled,
          updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        name: fields.name ?? existing.name,
        targetFolderName: fields.targetFolderName ?? existing.targetFolderName,
        icon: fields.icon ?? existing.icon,
        color: fields.color ?? existing.color,
        sortOrder: fields.sortOrder ?? existing.sortOrder,
        enabled: (fields.enabled ?? existing.enabled) ? 1 : 0,
        updatedAt: fields.updatedAt ?? existing.updatedAt
      })
    if (rules !== undefined) {
      this.db.prepare(`DELETE FROM desktop_category_rules WHERE category_id = ?`).run(id)
      const insertRule = this.db.prepare(
        `INSERT INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES (@id, @categoryId, @ruleType, @ruleJson, @sortOrder)`
      )
      rules.forEach((rule, index) => {
        insertRule.run({
          id: `${id}-rule-${index}`,
          categoryId: id,
          ruleType: rule.type,
          ruleJson: JSON.stringify(rule),
          sortOrder: index
        })
      })
    }
  }

  deleteCategory(id: string): void {
    this.db.prepare(`DELETE FROM desktop_categories WHERE id = ? AND is_system = 0`).run(id)
  }

  updateCategorySortOrders(orders: Array<{ id: string; sortOrder: number }>, updatedAt: string): void {
    const stmt = this.db.prepare(`UPDATE desktop_categories SET sort_order = ?, updated_at = ? WHERE id = ?`)
    const tx = this.db.transaction(() => {
      for (const o of orders) {
        stmt.run(o.sortOrder, updatedAt, o.id)
      }
    })
    tx()
  }

  getManualMap(): Map<string, string> {
    const rows = this.db
      .prepare(`SELECT item_path, category_id FROM desktop_manual_assignments`)
      .all() as Array<{ item_path: string; category_id: string }>
    return new Map(rows.map((r) => [r.item_path, r.category_id]))
  }

  setManualAssignment(itemPath: string, categoryId: string, updatedAt: string): void {
    this.db
      .prepare(
        `INSERT INTO desktop_manual_assignments (item_path, category_id, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(item_path) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at`
      )
      .run(itemPath, categoryId, updatedAt)
  }

  removeManualAssignment(itemPath: string): void {
    this.db.prepare(`DELETE FROM desktop_manual_assignments WHERE item_path = ?`).run(itemPath)
  }

  insertSnapshot(id: string, payload: OrganizeSnapshotPayload, createdAt: string): void {
    this.db
      .prepare(`INSERT INTO desktop_organize_snapshots (id, payload_json, created_at) VALUES (?, ?, ?)`)
      .run(id, JSON.stringify(payload), createdAt)
  }

  getLatestSnapshot(): { id: string; payload: OrganizeSnapshotPayload; createdAt: string } | null {
    const row = this.db
      .prepare(`SELECT id, payload_json, created_at FROM desktop_organize_snapshots ORDER BY created_at DESC LIMIT 1`)
      .get() as SnapshotRow | undefined
    if (!row) return null
    return {
      id: row.id,
      payload: JSON.parse(row.payload_json) as OrganizeSnapshotPayload,
      createdAt: row.created_at
    }
  }

  deleteSnapshot(id: string): void {
    this.db.prepare(`DELETE FROM desktop_organize_snapshots WHERE id = ?`).run(id)
  }

  hasSnapshot(): boolean {
    const row = this.db.prepare(`SELECT 1 FROM desktop_organize_snapshots LIMIT 1`).get()
    return !!row
  }

  listCustomRules(): DesktopCustomRule[] {
    const rows = this.db
      .prepare(`SELECT * FROM desktop_custom_rules ORDER BY sort_order ASC, created_at ASC`)
      .all() as CustomRuleRow[]
    return rows.map(mapCustomRule)
  }

  findCustomRuleById(id: string): DesktopCustomRule | null {
    const row = this.db.prepare(`SELECT * FROM desktop_custom_rules WHERE id = ?`).get(id) as
      | CustomRuleRow
      | undefined
    return row ? mapCustomRule(row) : null
  }

  insertCustomRule(rule: DesktopCustomRule): void {
    this.db
      .prepare(
        `INSERT INTO desktop_custom_rules
          (id, name, enabled, match_type, match_value, category_id, sort_order, created_at, updated_at)
         VALUES (@id, @name, @enabled, @matchType, @matchValue, @categoryId, @sortOrder, @createdAt, @updatedAt)`
      )
      .run({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled ? 1 : 0,
        matchType: rule.matchType,
        matchValue: rule.matchValue,
        categoryId: rule.categoryId,
        sortOrder: rule.sortOrder,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      })
  }

  updateCustomRule(id: string, fields: Partial<Omit<DesktopCustomRule, 'id' | 'createdAt'>>): void {
    const existing = this.findCustomRuleById(id)
    if (!existing) return
    this.db
      .prepare(
        `UPDATE desktop_custom_rules SET
          name = @name, enabled = @enabled, match_type = @matchType, match_value = @matchValue,
          category_id = @categoryId, sort_order = @sortOrder, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        name: fields.name ?? existing.name,
        enabled: (fields.enabled ?? existing.enabled) ? 1 : 0,
        matchType: fields.matchType ?? existing.matchType,
        matchValue: fields.matchValue ?? existing.matchValue,
        categoryId: fields.categoryId ?? existing.categoryId,
        sortOrder: fields.sortOrder ?? existing.sortOrder,
        updatedAt: fields.updatedAt ?? existing.updatedAt
      })
  }

  deleteCustomRule(id: string): void {
    this.db.prepare(`DELETE FROM desktop_custom_rules WHERE id = ?`).run(id)
  }
}

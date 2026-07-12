import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import {
  buildFenceDisplayItems,
  buildOrganizePlan,
  classifyDesktopItem,
  detectDesktopItemKind,
  resolveCategoryDir
} from '@shared/desktop-organize'
import { buildDefaultRuleRows } from '@shared/desktop-custom-rules'
import type {
  CreateDesktopCategoryDto,
  CreateDesktopCustomRuleDto,
  DesktopCategory,
  DesktopCustomRule,
  DesktopDefaultRuleRow,
  DesktopOrganizeExecuteResult,
  DesktopOrganizePlan,
  DesktopOrganizeSettings,
  DesktopScanItem,
  UpdateDesktopCategoryDto,
  UpdateDesktopCustomRuleDto,
  UpdateDesktopOrganizeSettingsDto
} from '@shared/desktop-organize-types'
import { AppError } from '@shared/types'
import type { DesktopOrganizeRepository } from '../db/desktop-organize-repository'
import { resolveDesktopPath } from './desktop-path'

const SKIP_NAMES = new Set(['desktop.ini'])

export class DesktopOrganizeService {
  constructor(private readonly repo: DesktopOrganizeRepository) {}

  getSettings(): DesktopOrganizeSettings {
    return this.repo.getSettings()
  }

  updateSettings(dto: UpdateDesktopOrganizeSettingsDto): DesktopOrganizeSettings {
    if (dto.folderPrefix !== undefined) {
      const prefix = dto.folderPrefix.trim()
      if (!prefix) {
        throw new AppError('VALIDATION_ERROR', '文件夹前缀不能为空')
      }
    }
    return this.repo.updateSettings(dto, nowIso())
  }

  listCategories(): DesktopCategory[] {
    return this.repo.listCategories()
  }

  createCategory(dto: CreateDesktopCategoryDto): DesktopCategory {
    const name = dto.name?.trim()
    if (!name) {
      throw new AppError('VALIDATION_ERROR', '分类名称不能为空')
    }
    const ts = nowIso()
    const id = uuidv4()
    const category: DesktopCategory = {
      id,
      name,
      targetFolderName: dto.targetFolderName?.trim() || name,
      icon: dto.icon ?? '📁',
      color: dto.color ?? '#dbeafe',
      sortOrder: dto.sortOrder ?? 150,
      enabled: dto.enabled ?? true,
      isSystem: false,
      rules: dto.rules ?? [],
      createdAt: ts,
      updatedAt: ts
    }
    const ruleRows = category.rules.map((rule, index) => ({
      id: `${id}-rule-${index}`,
      rule,
      sortOrder: index
    }))
    this.repo.insertCategory(category, ruleRows)
    return this.repo.findCategoryById(id)!
  }

  updateCategory(id: string, dto: UpdateDesktopCategoryDto): DesktopCategory {
    const existing = this.repo.findCategoryById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    const ts = nowIso()
    this.repo.updateCategory(
      id,
      {
        name: dto.name?.trim() ?? existing.name,
        targetFolderName: dto.targetFolderName?.trim() ?? existing.targetFolderName,
        icon: dto.icon ?? existing.icon,
        color: dto.color ?? existing.color,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        enabled: dto.enabled ?? existing.enabled,
        updatedAt: ts
      },
      dto.rules
    )
    return this.repo.findCategoryById(id)!
  }

  deleteCategory(id: string): void {
    const existing = this.repo.findCategoryById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    if (existing.isSystem) {
      throw new AppError('VALIDATION_ERROR', '系统分类不可删除')
    }
    this.repo.deleteCategory(id)
  }

  reorderCategories(orderedIds: string[]): DesktopCategory[] {
    const ts = nowIso()
    const orders = orderedIds.map((id, index) => ({ id, sortOrder: (index + 1) * 10 }))
    this.repo.updateCategorySortOrders(orders, ts)
    return this.repo.listCategories()
  }

  setManualAssignment(itemPath: string, categoryId: string): void {
    const category = this.repo.findCategoryById(categoryId)
    if (!category) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    this.repo.setManualAssignment(itemPath, categoryId, nowIso())
  }

  removeManualAssignment(itemPath: string): void {
    this.repo.removeManualAssignment(itemPath)
  }

  listCustomRules(): DesktopCustomRule[] {
    return this.repo.listCustomRules()
  }

  listDefaultRules(): DesktopDefaultRuleRow[] {
    return buildDefaultRuleRows(this.repo.listCategories())
  }

  createCustomRule(dto: CreateDesktopCustomRuleDto): DesktopCustomRule {
    const name = dto.name?.trim()
    if (!name) throw new AppError('VALIDATION_ERROR', '规则名称不能为空')
    const matchValue = dto.matchValue?.trim()
    if (!matchValue) throw new AppError('VALIDATION_ERROR', '匹配值不能为空')
    const category = this.repo.findCategoryById(dto.categoryId)
    if (!category) throw new AppError('NOT_FOUND', '目标分类不存在')
    const ts = nowIso()
    const rule: DesktopCustomRule = {
      id: uuidv4(),
      name,
      enabled: dto.enabled ?? true,
      matchType: dto.matchType,
      matchValue,
      categoryId: dto.categoryId,
      sortOrder: dto.sortOrder ?? this.repo.listCustomRules().length * 10,
      createdAt: ts,
      updatedAt: ts
    }
    this.repo.insertCustomRule(rule)
    return rule
  }

  updateCustomRule(id: string, dto: UpdateDesktopCustomRuleDto): DesktopCustomRule {
    const existing = this.repo.findCustomRuleById(id)
    if (!existing) throw new AppError('NOT_FOUND', '自定义规则不存在')
    const ts = nowIso()
    this.repo.updateCustomRule(id, {
      name: dto.name?.trim() ?? existing.name,
      matchType: dto.matchType ?? existing.matchType,
      matchValue: dto.matchValue?.trim() ?? existing.matchValue,
      categoryId: dto.categoryId ?? existing.categoryId,
      enabled: dto.enabled ?? existing.enabled,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: ts
    })
    return this.repo.findCustomRuleById(id)!
  }

  deleteCustomRule(id: string): void {
    if (!this.repo.findCustomRuleById(id)) {
      throw new AppError('NOT_FOUND', '自定义规则不存在')
    }
    this.repo.deleteCustomRule(id)
  }

  setDefaultRuleEnabled(categoryId: string, enabled: boolean): DesktopCategory {
    const cat = this.repo.findCategoryById(categoryId)
    if (!cat) throw new AppError('NOT_FOUND', '默认规则不存在')
    if (categoryId === 'uncategorized') {
      throw new AppError('VALIDATION_ERROR', '「其它」规则不可关闭')
    }
    this.repo.updateCategory(categoryId, { enabled, updatedAt: nowIso() })
    return this.repo.findCategoryById(categoryId)!
  }

  /** 自动整理：预览后若有移动项则执行 */
  autoOrganizeIfNeeded(): DesktopOrganizeExecuteResult | null {
    const plan = this.preview()
    if (plan.moves.length === 0) return null
    return this.execute(plan)
  }

  private getCustomRules(): DesktopCustomRule[] {
    return this.repo.listCustomRules()
  }

  scan(): DesktopScanItem[] {
    return this.scanItems()
  }

  /** Fence 展示：根目录未整理项 + 各 小柒整理-* 文件夹内的真实文件/图标 */
  scanForFences(): DesktopScanItem[] {
    const desktopPath = this.getDesktopPathInternal()
    const settings = this.repo.getSettings()
    const categories = this.repo.listCategories()
    const manualMap = this.repo.getManualMap()
    const folderPrefix = settings.folderPrefix

    const rootItems = this.readDesktopRoot(desktopPath, folderPrefix, false)
    const categoryFolderItems = new Map<string, DesktopScanItem[]>()

    for (const cat of categories) {
      if (!cat.enabled || cat.id === 'uncategorized') continue
      const catDir = resolveCategoryDir(desktopPath, folderPrefix, cat)
      const inner = this.readFolderOneLevel(catDir)
      if (inner.length > 0) {
        categoryFolderItems.set(cat.id, inner)
      }
    }

    return buildFenceDisplayItems({
      rootItems,
      categoryFolderItems,
      categories,
      manualMap,
      folderPrefix,
      customRules: this.getCustomRules()
    })
  }

  preview(): DesktopOrganizePlan {
    const desktopPath = this.getDesktopPathInternal()
    const settings = this.repo.getSettings()
    const categories = this.repo.listCategories()
    const manualMap = this.repo.getManualMap()
    const items = this.readDesktopRoot(desktopPath, settings.folderPrefix, false)
    return buildOrganizePlan({
      desktopPath,
      folderPrefix: settings.folderPrefix,
      items,
      categories,
      manualMap,
      customRules: this.getCustomRules(),
      exists: (p) => fs.existsSync(p),
      scannedAt: nowIso()
    })
  }

  /** Fence 展示：items 含已整理文件夹；moves 仍来自常规 preview */
  previewForFences(): DesktopOrganizePlan {
    const base = this.preview()
    return {
      ...base,
      items: this.scanForFences(),
      scannedAt: nowIso()
    }
  }

  private scanItems(): DesktopScanItem[] {
    const desktopPath = this.getDesktopPathInternal()
    const settings = this.repo.getSettings()
    const categories = this.repo.listCategories()
    const manualMap = this.repo.getManualMap()
    const customRules = this.getCustomRules()
    const items = this.readDesktopRoot(desktopPath, settings.folderPrefix, false)
    return items.map((item) => ({
      ...item,
      matchedCategoryId: classifyDesktopItem(item, categories, manualMap, customRules)
    }))
  }

  private readFolderOneLevel(folderPath: string): DesktopScanItem[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true })
    } catch {
      return []
    }
    const items: DesktopScanItem[] = []
    for (const entry of entries) {
      const name = entry.name
      if (SKIP_NAMES.has(name.toLowerCase())) continue
      if (name.startsWith('.')) continue
      if (!entry.isFile() && !entry.isDirectory()) continue
      items.push({
        name,
        absolutePath: path.join(folderPath, name),
        kind: detectDesktopItemKind(name, entry.isDirectory()),
        matchedCategoryId: null
      })
    }
    return items
  }

  execute(plan?: DesktopOrganizePlan): DesktopOrganizeExecuteResult {
    const organizePlan =
      plan && Array.isArray(plan.moves) && plan.moves.length > 0 ? plan : this.preview()
    if (organizePlan.moves.length === 0) {
      throw new AppError('VALIDATION_ERROR', '没有可移动的文件，请先扫描并确认分类规则')
    }
    const moved: DesktopOrganizeExecuteResult['moved'] = []
    const skipped: DesktopOrganizeExecuteResult['skipped'] = [...organizePlan.skipped]
    const snapshotMoves: Array<{ from: string; to: string }> = []

    for (const move of organizePlan.moves) {
      try {
        const destDir = path.dirname(move.to)
        fs.mkdirSync(destDir, { recursive: true })
        fs.renameSync(move.from, move.to)
        moved.push(move)
        snapshotMoves.push({ from: move.from, to: move.to })
      } catch (err) {
        const message = err instanceof Error ? err.message : '移动失败'
        skipped.push({ path: move.from, reason: message })
      }
    }

    let snapshotId: string | null = null
    if (snapshotMoves.length > 0) {
      snapshotId = uuidv4()
      this.repo.insertSnapshot(snapshotId, { moves: snapshotMoves }, nowIso())
    }

    return { moved, skipped, snapshotId }
  }

  undo(): { restored: number; skipped: Array<{ path: string; reason: string }> } {
    const snapshot = this.repo.getLatestSnapshot()
    if (!snapshot) {
      throw new AppError('NOT_FOUND', '没有可撤销的整理记录')
    }
    const skipped: Array<{ path: string; reason: string }> = []
    let restored = 0
    for (const move of [...snapshot.payload.moves].reverse()) {
      try {
        if (!fs.existsSync(move.to)) {
          skipped.push({ path: move.to, reason: '目标文件不存在' })
          continue
        }
        const destDir = path.dirname(move.from)
        fs.mkdirSync(destDir, { recursive: true })
        fs.renameSync(move.to, move.from)
        restored += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : '还原失败'
        skipped.push({ path: move.to, reason: message })
      }
    }
    this.repo.deleteSnapshot(snapshot.id)
    return { restored, skipped }
  }

  canUndo(): boolean {
    return this.repo.hasSnapshot()
  }

  getDesktopPath(): string {
    return resolveDesktopPath()
  }

  openDesktopFolder(): Promise<void> {
    const desktopPath = resolveDesktopPath()
    return shell.openPath(desktopPath).then((err) => {
      if (err) {
        throw new AppError('INTERNAL', `无法打开桌面文件夹：${err}`)
      }
    })
  }

  private getDesktopPathInternal(): string {
    return resolveDesktopPath()
  }

  private readDesktopRoot(
    desktopPath: string,
    folderPrefix: string,
    includeOrganizedFolders = false
  ): DesktopScanItem[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(desktopPath, { withFileTypes: true })
    } catch {
      return []
    }
    const items: DesktopScanItem[] = []
    for (const entry of entries) {
      const name = entry.name
      if (SKIP_NAMES.has(name.toLowerCase())) continue
      if (name.startsWith('.')) continue
      if (entry.isDirectory() && name.startsWith(folderPrefix)) {
        if (!includeOrganizedFolders) continue
      }
      if (!entry.isFile() && !entry.isDirectory()) continue
      items.push({
        name,
        absolutePath: path.join(desktopPath, name),
        kind: detectDesktopItemKind(name, entry.isDirectory()),
        matchedCategoryId: null
      })
    }
    return items
  }
}

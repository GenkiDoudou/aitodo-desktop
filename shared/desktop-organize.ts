import path from 'node:path'
import type {
  DesktopCategory,
  DesktopCategoryRule,
  DesktopItemKind,
  DesktopOrganizeMove,
  DesktopOrganizePlan,
  DesktopScanItem
} from './desktop-organize-types'
import type { DesktopCustomRule } from './desktop-custom-rules'
import { matchCustomRule } from './desktop-custom-rules'

const ICON_EXTENSIONS = new Set(['.lnk', '.url'])

/** 根据文件名判断桌面条目类型 */
export function detectDesktopItemKind(name: string, isDirectory: boolean): DesktopItemKind {
  if (isDirectory) return 'folder'
  const ext = path.extname(name).toLowerCase()
  if (ICON_EXTENSIONS.has(ext)) return 'icon'
  return 'file'
}

/** minimatch 子集：仅 * 与 ? */
export function matchNamePattern(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexSource = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
  return new RegExp(regexSource, 'i').test(name)
}

export function matchRule(item: DesktopScanItem, rule: DesktopCategoryRule): boolean {
  switch (rule.type) {
    case 'kind':
      return item.kind === rule.value
    case 'extension': {
      if (item.kind !== 'file') return false
      const ext = path.extname(item.name).toLowerCase()
      return rule.values.some((v) => v.toLowerCase() === ext)
    }
    case 'namePattern':
      return matchNamePattern(item.name, rule.pattern)
    case 'keyword':
      return item.name.toLowerCase().includes(rule.value.toLowerCase())
    case 'manual':
      return rule.itemPaths.includes(item.absolutePath)
    default:
      return false
  }
}

export function classifyDesktopItem(
  item: DesktopScanItem,
  categories: DesktopCategory[],
  manualMap: Map<string, string>,
  customRules: DesktopCustomRule[] = []
): string {
  const manual = manualMap.get(item.absolutePath)
  if (manual) return manual

  const sortedCustom = [...customRules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const rule of sortedCustom) {
    if (matchCustomRule(item, rule)) return rule.categoryId
  }

  const enabled = categories.filter((c) => c.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  for (const cat of enabled) {
    if (cat.rules.some((rule) => matchRule(item, rule))) return cat.id
  }
  return 'uncategorized'
}

export function resolveCategoryDir(
  desktopPath: string,
  folderPrefix: string,
  category: DesktopCategory
): string {
  return path.join(desktopPath, `${folderPrefix}${category.targetFolderName}`)
}

export function resolveItemTarget(
  desktopPath: string,
  folderPrefix: string,
  category: DesktopCategory,
  item: DesktopScanItem
): string {
  const catDir = resolveCategoryDir(desktopPath, folderPrefix, category)
  return path.join(catDir, item.name)
}

/** 目标路径是否位于源文件夹内部（禁止移入自身子路径） */
export function isMoveIntoSelf(sourcePath: string, targetPath: string): boolean {
  const rel = path.relative(sourcePath, targetPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** 同名冲突时使用 name (1).ext */
export function resolveUniquePath(
  targetPath: string,
  exists: (p: string) => boolean
): string {
  if (!exists(targetPath)) return targetPath
  const dir = path.dirname(targetPath)
  const ext = path.extname(targetPath)
  const base = path.basename(targetPath, ext)
  let n = 1
  while (exists(path.join(dir, `${base} (${n})${ext}`))) {
    n += 1
  }
  return path.join(dir, `${base} (${n})${ext}`)
}

export interface BuildOrganizePlanInput {
  desktopPath: string
  folderPrefix: string
  items: DesktopScanItem[]
  categories: DesktopCategory[]
  manualMap: Map<string, string>
  customRules?: DesktopCustomRule[]
  exists: (p: string) => boolean
  scannedAt?: string
}

export interface BuildFenceDisplayItemsInput {
  rootItems: DesktopScanItem[]
  categoryFolderItems: Map<string, DesktopScanItem[]>
  categories: DesktopCategory[]
  manualMap: Map<string, string>
  folderPrefix: string
  customRules?: DesktopCustomRule[]
}

/**
 * Fence 展示：桌面根未整理项 + 各分类文件夹内真实条目。
 * 不包含「小柒整理-*」容器文件夹本身。
 */
export function buildFenceDisplayItems(input: BuildFenceDisplayItemsInput): DesktopScanItem[] {
  const { rootItems, categoryFolderItems, categories, manualMap, folderPrefix, customRules = [] } = input
  const result: DesktopScanItem[] = []

  for (const item of rootItems) {
    if (item.kind === 'folder' && item.name.startsWith(folderPrefix)) continue
    result.push({
      ...item,
      matchedCategoryId: classifyDesktopItem(item, categories, manualMap, customRules)
    })
  }

  for (const [categoryId, items] of categoryFolderItems) {
    for (const item of items) {
      const manual = manualMap.get(item.absolutePath)
      result.push({
        ...item,
        matchedCategoryId: manual ?? categoryId
      })
    }
  }

  return result
}

export function buildOrganizePlan(input: BuildOrganizePlanInput): DesktopOrganizePlan {
  const {
    desktopPath,
    folderPrefix,
    items,
    categories,
    manualMap,
    customRules = [],
    exists,
    scannedAt = new Date().toISOString()
  } = input
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const reservedTargets = new Set<string>()
  const moves: DesktopOrganizeMove[] = []
  const skipped: Array<{ path: string; reason: string }> = []

  for (const item of items) {
    const categoryId = classifyDesktopItem(item, categories, manualMap, customRules)
    const category = categoryById.get(categoryId)
    if (!category) {
      skipped.push({ path: item.absolutePath, reason: '未找到分类' })
      continue
    }
    if (categoryId === 'uncategorized') {
      continue
    }
    let target = resolveItemTarget(desktopPath, folderPrefix, category, item)
    if (item.kind === 'folder' && isMoveIntoSelf(item.absolutePath, target)) {
      skipped.push({ path: item.absolutePath, reason: '不能将文件夹移入自身子路径' })
      continue
    }
    if (path.normalize(item.absolutePath) === path.normalize(target)) {
      continue
    }
    target = resolveUniquePath(target, (p) => exists(p) || reservedTargets.has(path.normalize(p)))
    reservedTargets.add(path.normalize(target))
    moves.push({
      from: item.absolutePath,
      to: target,
      categoryId: category.id,
      categoryName: category.name,
      itemName: item.name
    })
  }

  const classified = items.map((item) => ({
    ...item,
    matchedCategoryId: classifyDesktopItem(item, categories, manualMap, customRules)
  }))

  return {
    scannedAt,
    desktopPath,
    items: classified,
    moves,
    skipped
  }
}

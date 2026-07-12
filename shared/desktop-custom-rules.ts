import type { DesktopScanItem } from './desktop-organize-types'
import path from 'node:path'

/** 用户自定义整理规则（优先级高于默认分类规则） */
export interface DesktopCustomRule {
  id: string
  name: string
  enabled: boolean
  matchType: 'extension' | 'keyword'
  /** 扩展名逗号分隔（可带或不带点）；或关键字 */
  matchValue: string
  categoryId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateDesktopCustomRuleDto {
  name: string
  matchType: 'extension' | 'keyword'
  matchValue: string
  categoryId: string
  enabled?: boolean
  sortOrder?: number
}

export interface UpdateDesktopCustomRuleDto {
  name?: string
  matchType?: 'extension' | 'keyword'
  matchValue?: string
  categoryId?: string
  enabled?: boolean
  sortOrder?: number
}

/** 默认整理规则展示行（映射到已有分类） */
export interface DesktopDefaultRuleRow {
  id: string
  label: string
  /** 展示用后缀说明 */
  extensionsHint: string
  categoryId: string
  enabled: boolean
}

export function parseExtensionList(raw: string): string[] {
  return raw
    .split(/[,，;；\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.startsWith('.') ? s : `.${s}`))
}

/** 默认整理规则展示配置（对应分类 id） */
export const DEFAULT_RULE_TEMPLATES: Array<{ categoryId: string; label: string; extensionsHint: string }> = [
  { categoryId: 'folder', label: '文件夹', extensionsHint: '—' },
  { categoryId: 'cat-compress', label: '压缩包', extensionsHint: 'zip, rar, 7z, dmg, gz…' },
  { categoryId: 'cat-docs', label: '文档', extensionsHint: 'txt, pdf, doc, docx, ppt…' },
  { categoryId: 'cat-images', label: '图片', extensionsHint: 'jpg, png, gif, webp, psd…' },
  { categoryId: 'icon', label: '快捷方式', extensionsHint: 'lnk' },
  { categoryId: 'file', label: '网页链接', extensionsHint: 'url' },
  { categoryId: 'cat-audio', label: '音频', extensionsHint: 'mp3, wav, flac…' },
  { categoryId: 'cat-video', label: '视频', extensionsHint: 'mp4, avi, mov, mkv…' },
  { categoryId: 'uncategorized', label: '其它', extensionsHint: '不属于任何规则的文件' }
]

export function buildDefaultRuleRows(
  categories: import('./desktop-organize-types').DesktopCategory[]
): DesktopDefaultRuleRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return DEFAULT_RULE_TEMPLATES.map((tpl) => {
    const cat = byId.get(tpl.categoryId)
    return {
      id: tpl.categoryId,
      label: tpl.label,
      extensionsHint: tpl.extensionsHint,
      categoryId: tpl.categoryId,
      enabled: cat?.enabled ?? false
    }
  }).filter((row) => byId.has(row.categoryId) || row.categoryId === 'uncategorized')
}

export function matchCustomRule(item: DesktopScanItem, rule: DesktopCustomRule): boolean {
  if (!rule.enabled) return false
  if (rule.matchType === 'keyword') {
    const kw = rule.matchValue.trim()
    if (!kw) return false
    return item.name.toLowerCase().includes(kw.toLowerCase())
  }
  if (item.kind !== 'file' && item.kind !== 'icon') return false
  const ext = path.extname(item.name).toLowerCase()
  const list = parseExtensionList(rule.matchValue)
  return list.includes(ext)
}
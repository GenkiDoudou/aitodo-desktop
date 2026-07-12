import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildFenceDisplayItems,
  buildOrganizePlan,
  classifyDesktopItem,
  matchNamePattern,
  matchRule,
  resolveCategoryDir,
  resolveItemTarget,
  resolveUniquePath
} from './desktop-organize'
import type { DesktopCategory, DesktopScanItem } from './desktop-organize-types'

const desktop = 'C:\\Users\\me\\Desktop'
const prefix = '小柒整理-'

function item(name: string, kind: DesktopScanItem['kind'] = 'file'): DesktopScanItem {
  return {
    name,
    absolutePath: path.join(desktop, name),
    kind,
    matchedCategoryId: null
  }
}

function category(
  id: string,
  name: string,
  sortOrder: number,
  rules: DesktopCategory['rules']
): DesktopCategory {
  return {
    id,
    name,
    targetFolderName: name,
    icon: '📁',
    color: '#dbeafe',
    sortOrder,
    enabled: true,
    isSystem: false,
    rules,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00'
  }
}

describe('desktop-organize', () => {
  it('manual assignment wins over rules', () => {
    const pdf = item('report.pdf')
    const cats = [
      category('docs', '文档', 100, [{ type: 'extension', values: ['.pdf'] }]),
      category('images', '图片', 110, [{ type: 'extension', values: ['.png'] }])
    ]
    const manual = new Map([[pdf.absolutePath, 'images']])
    expect(classifyDesktopItem(pdf, cats, manual)).toBe('images')
  })

  it('custom rule wins over default category rules', () => {
    const named = item('双十一活动方案.pdf')
    const cats = [
      category('docs', '文档', 100, [{ type: 'extension', values: ['.pdf'] }]),
      category('promo', '双十一活动', 90, [{ type: 'keyword', value: '双十一' }])
    ]
    const customRules = [
      {
        id: 'r1',
        name: '双十一',
        enabled: true,
        matchType: 'keyword' as const,
        matchValue: '双十一',
        categoryId: 'promo',
        sortOrder: 0,
        createdAt: '',
        updatedAt: ''
      }
    ]
    expect(classifyDesktopItem(named, cats, new Map(), customRules)).toBe('promo')
  })

  it('sortOrder decides between matching categories', () => {
    const pdf = item('report.pdf')
    const cats = [
      category('docs', '文档', 100, [{ type: 'extension', values: ['.pdf'] }]),
      category('file', '文件', 200, [{ type: 'kind', value: 'file' }])
    ]
    expect(classifyDesktopItem(pdf, cats, new Map())).toBe('docs')
  })

  it('extension rule matches file kind', () => {
    const pdf = item('a.pdf')
    expect(matchRule(pdf, { type: 'extension', values: ['.pdf'] })).toBe(true)
    expect(matchRule(item('a.png'), { type: 'extension', values: ['.pdf'] })).toBe(false)
  })

  it('namePattern subset supports * and ?', () => {
    expect(matchNamePattern('季度报告.pdf', '*报告*')).toBe(true)
    expect(matchNamePattern('a.txt', '?.txt')).toBe(true)
    expect(matchNamePattern('ab.txt', '?.txt')).toBe(false)
  })

  it('resolve flat-prefix category dir (方案 C)', () => {
    const cat = category('docs', '文档', 100, [])
    expect(resolveCategoryDir(desktop, prefix, cat)).toBe(
      path.join(desktop, '小柒整理-文档')
    )
    expect(resolveItemTarget(desktop, prefix, cat, item('report.pdf'))).toBe(
      path.join(desktop, '小柒整理-文档', 'report.pdf')
    )
  })

  it('buildOrganizePlan handles name collision', () => {
    const cat = category('docs', '文档', 100, [{ type: 'extension', values: ['.pdf'] }])
    const pdf = item('report.pdf')
    const target = resolveItemTarget(desktop, prefix, cat, pdf)
    const plan = buildOrganizePlan({
      desktopPath: desktop,
      folderPrefix: prefix,
      items: [pdf],
      categories: [cat, category('uncategorized', '未分类', 999, [])],
      manualMap: new Map(),
      exists: (p) => path.normalize(p) === path.normalize(target)
    })
    expect(plan.moves[0]?.to).toBe(path.join(path.dirname(target), 'report (1).pdf'))
  })

  it('resolveUniquePath increments suffix', () => {
    const dir = path.join(desktop, '小柒整理-文档')
    const base = path.join(dir, 'a.txt')
    const exists = (p: string) => {
      const n = path.normalize(p)
      return n === path.normalize(base) || n === path.normalize(path.join(dir, 'a (1).txt'))
    }
    expect(resolveUniquePath(base, exists)).toBe(path.join(dir, 'a (2).txt'))
  })

  it('buildFenceDisplayItems reads folder contents not container folders', () => {
    const cats = [
      category('docs', '文档', 100, [{ type: 'extension', values: ['.pdf'] }]),
      category('icons', '图标', 200, [{ type: 'kind', value: 'icon' }])
    ]
    const rootItems = [
      item('小柒整理-文档', 'folder'),
      item('todo.lnk', 'icon')
    ]
    const innerDoc = item('report.pdf', 'file')
    innerDoc.absolutePath = path.join(desktop, '小柒整理-文档', 'report.pdf')
    const innerIcon = item('game.lnk', 'icon')
    innerIcon.absolutePath = path.join(desktop, '小柒整理-图标', 'game.lnk')

    const result = buildFenceDisplayItems({
      rootItems,
      categoryFolderItems: new Map([
        ['docs', [innerDoc]],
        ['icons', [innerIcon]]
      ]),
      categories: cats,
      manualMap: new Map(),
      folderPrefix: prefix
    })

    expect(result.map((i) => i.name).sort()).toEqual(['game.lnk', 'report.pdf', 'todo.lnk'])
    expect(result.find((i) => i.name === '小柒整理-文档')).toBeUndefined()
    expect(result.find((i) => i.name === 'report.pdf')?.matchedCategoryId).toBe('docs')
    expect(result.find((i) => i.name === 'todo.lnk')?.matchedCategoryId).toBe('icons')
  })
})

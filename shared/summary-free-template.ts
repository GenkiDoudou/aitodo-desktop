import type { Task } from './types'
import type { SummaryScheduleType } from './scheduled-summary'
import type { SummaryTaskFilter, SummaryTimeScope } from './summary-report-config'
import {
  localDayBounds,
  resolveSectionTimeBounds,
  type ResolvedTimeBounds
} from './summary-report-config'
import type dayjs from 'dayjs'

export class SummaryTemplateError extends Error {
  readonly line: number
  constructor(line: number, message: string) {
    super(`第 ${line} 行：${message}`)
    this.name = 'SummaryTemplateError'
    this.line = line
  }
}

export type TemplateNode =
  | { type: 'text'; value: string }
  | { type: 'var'; name: string; line: number }
  | { type: 'if'; field: string; children: TemplateNode[]; line: number }
  | {
      type: 'tasks'
      children: TemplateNode[]
      line: number
    }
  | {
      type: 'section'
      attrs: Record<string, string>
      children: TemplateNode[]
      line: number
    }

const SECTION_ATTRS = new Set([
  'status',
  'due',
  'list',
  'listId',
  'title',
  'time',
  'hideEmpty'
])

const TASK_FIELDS = new Set([
  'title',
  'dueAt',
  'completedAt',
  'categoryName',
  'status',
  'count',
  'sectionTitle'
])

const OPEN_TAG =
  /\{\{\s*#(section|tasks|if)(?:\s+([^}]*?))?\s*\}\}/g
const CLOSE_TAG = /\{\{\s*\/(section|tasks|if)\s*\}\}/g
const VAR_TAG = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
const COMMENT_TAG = /\{\{\s*!--[\s\S]*?--\s*\}\}/g

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function parseAttrs(raw: string | undefined, line: number): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!raw?.trim()) return attrs
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g
  let m: RegExpExecArray | null
  let matched = false
  while ((m = re.exec(raw)) !== null) {
    matched = true
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  if (!matched && raw.trim()) {
    throw new SummaryTemplateError(line, `无法解析属性：${raw.trim()}`)
  }
  return attrs
}

type Token =
  | { kind: 'text'; value: string; index: number }
  | { kind: 'open'; name: 'section' | 'tasks' | 'if'; attrs: string; index: number; line: number }
  | { kind: 'close'; name: 'section' | 'tasks' | 'if'; index: number; line: number }
  | { kind: 'var'; name: string; index: number; line: number }

function tokenize(source: string): Token[] {
  // 注释替换为等长空白（保留换行）以免影响行号
  const stripped = source.replace(COMMENT_TAG, (full) => full.replace(/[^\n]/g, ' '))

  const markers: Array<{ index: number; end: number; token: Token }> = []

  let m: RegExpExecArray | null
  const openRe = new RegExp(OPEN_TAG.source, 'g')
  while ((m = openRe.exec(stripped)) !== null) {
    const name = m[1] as 'section' | 'tasks' | 'if'
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: 'open',
        name,
        attrs: m[2] ?? '',
        index: m.index,
        line: lineAt(source, m.index)
      }
    })
  }
  const closeRe = new RegExp(CLOSE_TAG.source, 'g')
  while ((m = closeRe.exec(stripped)) !== null) {
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: 'close',
        name: m[1] as 'section' | 'tasks' | 'if',
        index: m.index,
        line: lineAt(source, m.index)
      }
    })
  }
  const varRe = new RegExp(VAR_TAG.source, 'g')
  while ((m = varRe.exec(stripped)) !== null) {
    // 跳过 open/close 已覆盖的区间（理论上不会重叠）
    const overlapping = markers.some((x) => m!.index >= x.index && m!.index < x.end)
    if (overlapping) continue
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: 'var',
        name: m[1],
        index: m.index,
        line: lineAt(source, m.index)
      }
    })
  }

  markers.sort((a, b) => a.index - b.index)
  const tokens: Token[] = []
  let cursor = 0
  for (const marker of markers) {
    if (marker.index > cursor) {
      tokens.push({ kind: 'text', value: stripped.slice(cursor, marker.index), index: cursor })
    }
    tokens.push(marker.token)
    cursor = marker.end
  }
  if (cursor < stripped.length) {
    tokens.push({ kind: 'text', value: stripped.slice(cursor), index: cursor })
  }
  return tokens
}

function parseTokens(tokens: Token[], source: string): TemplateNode[] {
  let i = 0

  function parseBlock(until?: 'section' | 'tasks' | 'if'): TemplateNode[] {
    const nodes: TemplateNode[] = []
    while (i < tokens.length) {
      const tok = tokens[i]
      if (tok.kind === 'close') {
        if (until && tok.name === until) {
          i += 1
          return nodes
        }
        throw new SummaryTemplateError(tok.line, `意外的闭合标签 {{/${tok.name}}}`)
      }
      if (tok.kind === 'text') {
        if (tok.value) nodes.push({ type: 'text', value: tok.value })
        i += 1
        continue
      }
      if (tok.kind === 'var') {
        nodes.push({ type: 'var', name: tok.name, line: tok.line })
        i += 1
        continue
      }
      if (tok.kind === 'open') {
        const line = tok.line
        const name = tok.name
        const rawAttrs = tok.attrs
        i += 1
        if (name === 'section') {
          const attrs = parseAttrs(rawAttrs, line)
          const children = parseBlock('section')
          nodes.push({ type: 'section', attrs, children, line })
          continue
        }
        if (name === 'tasks') {
          if (rawAttrs.trim()) {
            throw new SummaryTemplateError(line, 'tasks 标签不接受属性')
          }
          const children = parseBlock('tasks')
          nodes.push({ type: 'tasks', children, line })
          continue
        }
        if (name === 'if') {
          const field = rawAttrs.trim()
          if (!field || /\s/.test(field) || field.includes('=')) {
            throw new SummaryTemplateError(line, 'if 仅支持 {{#if fieldName}} 形式')
          }
          const children = parseBlock('if')
          nodes.push({ type: 'if', field, children, line })
          continue
        }
      }
    }
    if (until) {
      throw new SummaryTemplateError(lineAt(source, source.length), `未闭合的 {{#${until}}}`)
    }
    return nodes
  }

  const ast = parseBlock()
  return ast
}

export function parseSummaryTemplate(source: string): TemplateNode[] {
  const tokens = tokenize(source)
  return parseTokens(tokens, source)
}

export function validateSummaryTemplateAst(nodes: TemplateNode[]): void {
  const walk = (list: TemplateNode[], inTasks: boolean) => {
    for (const node of list) {
      if (node.type === 'section') {
        validateSectionAttrs(node.attrs, node.line)
        walk(node.children, false)
      } else if (node.type === 'tasks') {
        walk(node.children, true)
      } else if (node.type === 'if') {
        if (!TASK_FIELDS.has(node.field)) {
          throw new SummaryTemplateError(node.line, `if 不支持字段「${node.field}」`)
        }
        walk(node.children, inTasks)
      } else if (node.type === 'var') {
        if (!TASK_FIELDS.has(node.name)) {
          throw new SummaryTemplateError(node.line, `未知字段「${node.name}」`)
        }
      }
    }
  }
  walk(nodes, false)
}

function validateSectionAttrs(attrs: Record<string, string>, line: number): void {
  for (const key of Object.keys(attrs)) {
    if (!SECTION_ATTRS.has(key)) {
      throw new SummaryTemplateError(line, `未知属性「${key}」`)
    }
  }
  const status = attrs.status
  if (status !== 'completed' && status !== 'pending' && status !== 'overdue') {
    throw new SummaryTemplateError(line, 'section 必须提供 status=completed|pending|overdue')
  }
  if (attrs.due != null && attrs.due !== 'today') {
    throw new SummaryTemplateError(line, 'due 仅支持 today')
  }
  if (attrs.time != null) {
    const t = attrs.time
    if (
      t !== 'today' &&
      t !== 'this_week' &&
      t !== 'this_month' &&
      t !== 'last_7_days' &&
      t !== 'last_30_days' &&
      t !== 'since_last'
    ) {
      throw new SummaryTemplateError(line, `无效 time「${t}」`)
    }
  }
  if (attrs.hideEmpty != null && attrs.hideEmpty !== 'true' && attrs.hideEmpty !== 'false') {
    throw new SummaryTemplateError(line, 'hideEmpty 仅支持 true/false')
  }
}

export interface TemplateSectionQuerySpec {
  status: SummaryTaskFilter
  timePreset: SummaryTimeScope
  dueTodayOnly: boolean
  listName?: string
  listId?: string
  title: string
  hideEmpty: boolean
  line: number
}

export function sectionAttrsToQuerySpec(attrs: Record<string, string>, line: number): TemplateSectionQuerySpec {
  validateSectionAttrs(attrs, line)
  const status = attrs.status as SummaryTaskFilter
  const timePreset = (attrs.time as SummaryTimeScope | undefined) ?? (status === 'completed' ? 'since_last' : 'today')
  return {
    status,
    timePreset,
    dueTodayOnly: attrs.due === 'today',
    listName: attrs.list?.trim() || undefined,
    listId: attrs.listId?.trim() || undefined,
    title: attrs.title?.trim() || '未命名区块',
    hideEmpty: attrs.hideEmpty === 'true',
    line
  }
}

export interface FreeTemplateRenderContext {
  scheduleType: SummaryScheduleType
  now: dayjs.Dayjs
  lastSentAt: string | null
  /** 清单名（小写）→ id；以及原名映射用于报错 */
  resolveListId: (listNameOrId: { listName?: string; listId?: string; line: number }) => string | undefined
  categoryNames: Map<string, string>
  fetchTasks: (spec: {
    status: SummaryTaskFilter
    bounds: ResolvedTimeBounds
    categoryIds?: string[]
    dueBetween?: { from: string; to: string } | null
  }) => Task[]
}

function formatField(task: Task | null, name: string, extras: { count: number; sectionTitle: string; categoryNames: Map<string, string> }): string {
  if (name === 'count') return String(extras.count)
  if (name === 'sectionTitle') return extras.sectionTitle
  if (!task) return ''
  if (name === 'title') return task.title
  if (name === 'dueAt') return task.dueAt?.slice(0, 16).replace('T', ' ') ?? ''
  if (name === 'completedAt') return task.completedAt?.slice(0, 16).replace('T', ' ') ?? ''
  if (name === 'categoryName') {
    return task.categoryId ? extras.categoryNames.get(task.categoryId) ?? '未分类' : '未分类'
  }
  if (name === 'status') return task.status
  return ''
}

function renderNodes(
  nodes: TemplateNode[],
  ctx: FreeTemplateRenderContext,
  scope: { task: Task | null; count: number; sectionTitle: string }
): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      out += node.value
      continue
    }
    if (node.type === 'var') {
      out += formatField(scope.task, node.name, {
        count: scope.count,
        sectionTitle: scope.sectionTitle,
        categoryNames: ctx.categoryNames
      })
      continue
    }
    if (node.type === 'if') {
      const value = formatField(scope.task, node.field, {
        count: scope.count,
        sectionTitle: scope.sectionTitle,
        categoryNames: ctx.categoryNames
      })
      if (value) {
        out += renderNodes(node.children, ctx, scope)
      }
      continue
    }
    if (node.type === 'tasks') {
      // tasks 必须由 section 渲染时展开；顶层 tasks 视为错误在 validate 可选——这里允许空
      continue
    }
    if (node.type === 'section') {
      const spec = sectionAttrsToQuerySpec(node.attrs, node.line)
      const bounds = resolveSectionTimeBounds(spec.timePreset, ctx.scheduleType, ctx.now, ctx.lastSentAt)
      const categoryId = ctx.resolveListId({
        listName: spec.listName,
        listId: spec.listId,
        line: spec.line
      })
      const categoryIds = categoryId ? [categoryId] : undefined
      const dueBetween = spec.dueTodayOnly ? localDayBounds(ctx.now) : null
      const tasks = ctx.fetchTasks({
        status: spec.status,
        bounds,
        categoryIds,
        dueBetween
      })
      if (!tasks.length && spec.hideEmpty) {
        continue
      }
      const sectionScopeBase = { task: null as Task | null, count: tasks.length, sectionTitle: spec.title }
      out += renderSectionBody(node.children, ctx, sectionScopeBase, tasks)
    }
  }
  return out
}

function renderSectionBody(
  nodes: TemplateNode[],
  ctx: FreeTemplateRenderContext,
  scope: { task: Task | null; count: number; sectionTitle: string },
  tasks: Task[]
): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'tasks') {
      for (const task of tasks) {
        out += renderNodes(node.children, ctx, {
          task,
          count: scope.count,
          sectionTitle: scope.sectionTitle
        })
      }
      continue
    }
    if (node.type === 'section') {
      // 嵌套 section：递归走主渲染
      out += renderNodes([node], ctx, scope)
      continue
    }
    out += renderNodes([node], ctx, scope)
  }
  return out
}

/** 解析 + 校验 + 渲染一体化 */
export function renderSummaryFreeTemplate(body: string, ctx: FreeTemplateRenderContext): string {
  const ast = parseSummaryTemplate(body)
  validateSummaryTemplateAst(ast)
  return renderNodes(ast, ctx, { task: null, count: 0, sectionTitle: '' }).replace(/\n{3,}/g, '\n\n').trim()
}

export function assertValidSummaryFreeTemplate(body: string): void {
  const ast = parseSummaryTemplate(body)
  validateSummaryTemplateAst(ast)
}

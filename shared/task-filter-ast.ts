import dayjs, { type Dayjs } from 'dayjs'
import type { Task, TaskStatus } from './types'
import { resolveTaskDateIso } from './date-filter'

/** 条件字段 */
export type FilterField =
  | 'category'
  | 'priority'
  | 'status'
  | 'dueAt'
  | 'createdAt'
  | 'completedAt'
  | 'title'
  | 'hasSubtasks'
  | 'hasRecurrence'
  | 'kanbanGroup'

export type FilterOp =
  | 'in'
  | 'eq'
  | 'neq'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'rel'
  | 'between'
  | 'isTrue'
  | 'isFalse'

/** 相对时间预设 */
export type FilterTimeRel =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'overdue'
  | 'noDate'
  | 'hasDate'

export type FilterNode =
  | { type: 'group'; op: 'and' | 'or'; children: FilterNode[]; not?: boolean }
  | {
      type: 'cond'
      field: FilterField
      op: FilterOp
      /** 依字段而定：string[] / number / string / { from,to } / FilterTimeRel / boolean */
      value?: unknown
    }

export interface TaskFilterAstContext {
  /** 求值锚点，默认 now；日历可传入「今天」 */
  now?: Dayjs
  /**
   * 任务 id → 是否有未删除子任务。
   * 未提供时：hasSubtasks 条件对未知任务视为 false（无子任务）。
   */
  hasSubtasksById?: Map<string, boolean>
  /**
   * 日历循环展开后：时间类叶子以实例日期为准。
   * 传入 YYYY-MM-DD 时，dueAt / createdAt / completedAt 的「日」比较使用该日（保留任务时刻仅在 between 全量 iso 时仍用 task 字段）。
   * 约定：展开后的实例应把 dueAt 写成实例日；若同时传 instanceDateKey，相对预设优先用该日。
   */
  instanceDateKey?: string
}

const TIME_FIELDS: FilterField[] = ['dueAt', 'createdAt', 'completedAt']

export function createEmptyAndGroup(): FilterNode {
  return { type: 'group', op: 'and', children: [] }
}

export function normalizeFilterNode(node: FilterNode | null | undefined): FilterNode {
  if (!node || typeof node !== 'object') return createEmptyAndGroup()
  if (node.type === 'group') {
    const children = (node.children ?? [])
      .map((c) => normalizeFilterNode(c))
      .filter((c) => {
        if (c.type === 'group') return c.children.length > 0
        return true
      })
    return {
      type: 'group',
      op: node.op === 'or' ? 'or' : 'and',
      not: node.not ? true : undefined,
      children
    }
  }
  return {
    type: 'cond',
    field: node.field,
    op: node.op,
    value: node.value
  }
}

/** 校验失败返回错误信息；通过返回 null */
export function validateFilterNode(node: FilterNode): string | null {
  const n = normalizeFilterNode(node)
  return validateNodeRecursive(n)
}

function validateNodeRecursive(node: FilterNode): string | null {
  if (node.type === 'group') {
    if (node.children.length === 0) {
      return '条件组不能为空'
    }
    for (const child of node.children) {
      const err = validateNodeRecursive(child)
      if (err) return err
    }
    return null
  }
  return validateCond(node)
}

function validateCond(cond: Extract<FilterNode, { type: 'cond' }>): string | null {
  const { field, op, value } = cond
  if (op === 'isEmpty' || op === 'isNotEmpty' || op === 'isTrue' || op === 'isFalse') {
    return null
  }
  if (field === 'category' && op === 'in') {
    if (!Array.isArray(value) || value.length === 0) return '请选择至少一个清单'
    return null
  }
  if (field === 'priority' && (op === 'in' || op === 'eq')) {
    if (op === 'in' && (!Array.isArray(value) || value.length === 0)) return '请选择优先级'
    if (op === 'eq' && (typeof value !== 'number' || value < 1 || value > 4)) return '优先级无效'
    return null
  }
  if (field === 'status' && (op === 'in' || op === 'eq')) {
    if (op === 'in' && (!Array.isArray(value) || value.length === 0)) return '请选择状态'
    if (op === 'eq' && typeof value !== 'string') return '状态无效'
    return null
  }
  if (TIME_FIELDS.includes(field)) {
    if (op === 'rel') {
      if (typeof value !== 'string' || !value) return '请选择时间范围'
      return null
    }
    if (op === 'between') {
      const v = value as { from?: string; to?: string } | null
      if (!v?.from || !v?.to) return '请填写起止日期'
      return null
    }
  }
  if (field === 'title' && (op === 'contains' || op === 'notContains')) {
    if (typeof value !== 'string' || !value.trim()) return '请输入标题关键词'
    return null
  }
  if (field === 'kanbanGroup' && op === 'eq') {
    // null = 未分组；string = 分组 id
    if (value !== null && typeof value !== 'string') return '看板分组无效'
    return null
  }
  if (field === 'hasSubtasks' || field === 'hasRecurrence') {
    if (op !== 'isTrue' && op !== 'isFalse' && op !== 'eq') return '运算符不适用于该字段'
    return null
  }
  return null
}

/** 两棵树 AND 合并（空组直接返回另一侧） */
export function andCombine(a: FilterNode | null | undefined, b: FilterNode | null | undefined): FilterNode {
  const na = normalizeFilterNode(a)
  const nb = normalizeFilterNode(b)
  const aEmpty = na.type === 'group' && na.children.length === 0
  const bEmpty = nb.type === 'group' && nb.children.length === 0
  if (aEmpty && bEmpty) return createEmptyAndGroup()
  if (aEmpty) return nb
  if (bEmpty) return na
  return normalizeFilterNode({ type: 'group', op: 'and', children: [na, nb] })
}

export function parseFilterAstJson(raw: string): FilterNode {
  const parsed = JSON.parse(raw) as FilterNode
  return normalizeFilterNode(parsed)
}

export function serializeFilterAst(node: FilterNode): string {
  return JSON.stringify(normalizeFilterNode(node))
}

/**
 * 判断任务是否命中过滤树。
 * NOTE（日历）：循环展开后的实例应带实例 dueAt；或在 ctx.instanceDateKey 传入 YYYY-MM-DD，
 * 相对日期预设（today/week/overdue/…）按该日解释，与母任务锚点解耦。
 */
export function matchTask(
  task: Task,
  node: FilterNode | null | undefined,
  ctx: TaskFilterAstContext = {}
): boolean {
  const tree = normalizeFilterNode(node)
  if (tree.type === 'group' && tree.children.length === 0) {
    return true
  }
  return evalNode(task, tree, ctx)
}

function evalNode(task: Task, node: FilterNode, ctx: TaskFilterAstContext): boolean {
  if (node.type === 'group') {
    const results = node.children.map((c) => evalNode(task, c, ctx))
    let ok = node.op === 'and' ? results.every(Boolean) : results.some(Boolean)
    if (node.not) ok = !ok
    return ok
  }
  return evalCond(task, node, ctx)
}

function evalCond(
  task: Task,
  cond: Extract<FilterNode, { type: 'cond' }>,
  ctx: TaskFilterAstContext
): boolean {
  const { field, op, value } = cond
  switch (field) {
    case 'category':
      return matchCategory(task, op, value)
    case 'priority':
      return matchPriority(task, op, value)
    case 'status':
      return matchStatus(task, op, value)
    case 'dueAt':
    case 'createdAt':
    case 'completedAt':
      return matchTimeField(task, field, op, value, ctx)
    case 'title':
      return matchTitle(task, op, value)
    case 'hasSubtasks':
      return matchHasSubtasks(task, op, value, ctx)
    case 'hasRecurrence':
      return matchHasRecurrence(task, op, value)
    case 'kanbanGroup':
      return matchKanbanGroup(task, op, value)
    default:
      return false
  }
}

function matchCategory(task: Task, op: FilterOp, value: unknown): boolean {
  const cat = task.categoryId
  if (op === 'isEmpty') return cat == null
  if (op === 'isNotEmpty') return cat != null
  if (op === 'in' && Array.isArray(value)) {
    // 用特殊哨兵 '__uncategorized__' 表示未分类
    return value.some((v) => (v === '__uncategorized__' ? cat == null : v === cat))
  }
  if (op === 'eq') {
    if (value === '__uncategorized__' || value === null) return cat == null
    return cat === value
  }
  return false
}

function matchPriority(task: Task, op: FilterOp, value: unknown): boolean {
  const p = task.priority
  if (op === 'eq') return p === value
  if (op === 'in' && Array.isArray(value)) return value.includes(p)
  if (op === 'neq') return p !== value
  return false
}

function matchStatus(task: Task, op: FilterOp, value: unknown): boolean {
  const s = task.status
  if (op === 'eq') return s === value
  if (op === 'in' && Array.isArray(value)) return (value as TaskStatus[]).includes(s)
  if (op === 'neq') return s !== value
  return false
}

function matchTitle(task: Task, op: FilterOp, value: unknown): boolean {
  const t = task.title.toLowerCase()
  const q = String(value ?? '')
    .trim()
    .toLowerCase()
  if (op === 'contains') return q.length > 0 && t.includes(q)
  if (op === 'notContains') return q.length > 0 && !t.includes(q)
  if (op === 'isEmpty') return !task.title.trim()
  if (op === 'isNotEmpty') return Boolean(task.title.trim())
  return false
}

function matchHasSubtasks(
  task: Task,
  op: FilterOp,
  value: unknown,
  ctx: TaskFilterAstContext
): boolean {
  const has = ctx.hasSubtasksById?.get(task.id) ?? false
  if (op === 'isTrue' || (op === 'eq' && value === true)) return has
  if (op === 'isFalse' || (op === 'eq' && value === false)) return !has
  return false
}

function matchHasRecurrence(task: Task, op: FilterOp, value: unknown): boolean {
  const has = Boolean(task.recurrence && task.recurrence.type !== 'none')
  if (op === 'isTrue' || (op === 'eq' && value === true)) return has
  if (op === 'isFalse' || (op === 'eq' && value === false)) return !has
  return false
}

function matchKanbanGroup(task: Task, op: FilterOp, value: unknown): boolean {
  const gid = task.kanbanGroupId ?? null
  if (op === 'isEmpty') return gid == null
  if (op === 'isNotEmpty') return gid != null
  if (op === 'eq') {
    if (value === null || value === '__ungrouped__') return gid == null
    return gid === value
  }
  return false
}

function matchTimeField(
  task: Task,
  field: 'dueAt' | 'createdAt' | 'completedAt',
  op: FilterOp,
  value: unknown,
  ctx: TaskFilterAstContext
): boolean {
  const now = ctx.now ?? dayjs()
  // 日历实例：相对预设用 instanceDateKey 作为「任务日」
  let iso = resolveTaskDateIso(task, field)
  if (ctx.instanceDateKey && field === 'dueAt') {
    // 实例日优先：构造当日午夜作相对比较；between 仍用任务完整 iso 若有
    const timePart = task.dueAt && task.dueAt.length >= 19 ? task.dueAt.slice(10) : 'T00:00:00'
    iso = `${ctx.instanceDateKey}${timePart.startsWith('T') ? timePart : `T${timePart}`}`
  }

  if (op === 'isEmpty' || (op === 'rel' && value === 'noDate')) {
    return iso == null
  }
  if (op === 'isNotEmpty' || (op === 'rel' && value === 'hasDate')) {
    return iso != null
  }
  if (!iso) return false

  const d = dayjs(iso)
  if (!d.isValid()) return false

  if (op === 'rel') {
    return matchTimeRel(d, value as FilterTimeRel, now)
  }
  if (op === 'between') {
    const range = value as { from: string; to: string }
    return iso >= range.from && iso <= range.to
  }
  return false
}

function matchTimeRel(d: Dayjs, rel: FilterTimeRel, now: Dayjs): boolean {
  const day = d.startOf('day')
  const today = now.startOf('day')
  switch (rel) {
    case 'today':
      return day.isSame(today, 'day')
    case 'tomorrow':
      return day.isSame(today.add(1, 'day'), 'day')
    case 'week': {
      const start = today.startOf('week')
      const end = today.endOf('week')
      return !day.isBefore(start, 'day') && !day.isAfter(end, 'day')
    }
    case 'overdue':
      return day.isBefore(today, 'day')
    case 'noDate':
      return false
    case 'hasDate':
      return true
    default:
      return false
  }
}

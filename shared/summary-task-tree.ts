import type { Task } from './types'

export interface SummaryTaskTreeRow {
  task: Task
  depth: number
  matched: boolean
}

export interface LayoutSummaryTaskTreeOptions {
  /** 对已排序匹配集截断；锚点不占名额 */
  limit?: number | null
  /**
   * 用于“补齐未命中父任务”的唯一入口：
   * - 输入：父任务 id
   * - 输出：真实父任务（如果已被删除或找不到，返回 null）
   *
   * 注意：这里不会改变原有筛选语义，只做结构锚点补齐。
   */
  resolveById: (id: string) => Task | null
}

/**
 * 将“汇总命中任务 matched”排布为树形行（用于定时汇总/预览的纯文本渲染）。
 *
 * 核心语义（与你的需求对齐）：
 * 1) limit / 展示计数只作用于 matched（命中集合），结构锚点 ancestors 不占名额；
 * 2) matched 集合里每个任务都标记 matched=true；
 * 3) 如果 matched 中的某个任务 parent 不在 matched 内，则把 parent 及其祖先补齐为锚点行，
 *    对锚点行 matched=false，但只输出标题，不附带“完成时间/截止”等 matched 后缀信息。
 *
 * 遍历顺序：
 * - 先对 matched 做 limit 截断 -> 得到 limited；
 * - 再补齐 limited 的所有祖先 -> 得到 enriched；
 * - 按 parentId 建树后 DFS 输出。
 * - 同级顺序通过 matched 集合里的相对位置推导（用 subtreeOrder 近似保持视觉顺序）。
 */
export function layoutSummaryTaskTree(
  matched: Task[],
  options: LayoutSummaryTaskTreeOptions
): { rows: SummaryTaskTreeRow[]; matchedCount: number } {
  const limited =
    options.limit != null && options.limit > 0 ? matched.slice(0, options.limit) : matched
  const matchedCount = limited.length
  const matchedIds = new Set(limited.map((t) => t.id))
  const byId = new Map<string, Task>()
  for (const t of limited) byId.set(t.id, t)

  // 补齐祖先（防环 / 防止脏数据导致无限循环）
  for (const t of limited) {
    let parentId = t.parentId
    const seen = new Set<string>()
    while (parentId) {
      if (seen.has(parentId) || byId.has(parentId)) break
      seen.add(parentId)
      const parent = options.resolveById(parentId)
      if (!parent || parent.deletedAt) break
      byId.set(parent.id, parent)
      parentId = parent.parentId
    }
  }

  const orderIndex = new Map<string, number>()
  limited.forEach((t, i) => orderIndex.set(t.id, i))

  const byParent = new Map<string | null, Task[]>()
  for (const t of byId.values()) {
    const key =
      t.parentId && byId.has(t.parentId) ? t.parentId : null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(t)
  }

  function subtreeOrder(task: Task): number {
    if (orderIndex.has(task.id)) return orderIndex.get(task.id)!
    // 对于锚点父（不在 limited 中），我们用“其子树中最早 matched 的索引”
    // 作为近似排序依据，从而尽量保持“匹配任务的视觉相对顺序”。
    let min = Number.POSITIVE_INFINITY
    for (const child of byParent.get(task.id) ?? []) {
      min = Math.min(min, subtreeOrder(child))
    }
    return Number.isFinite(min) ? min : Number.MAX_SAFE_INTEGER
  }

  for (const [, list] of byParent) {
    list.sort((a, b) => subtreeOrder(a) - subtreeOrder(b))
  }

  const rows: SummaryTaskTreeRow[] = []

  function walk(task: Task, depth: number) {
    rows.push({
      task,
      depth,
      matched: matchedIds.has(task.id)
    })
    for (const child of byParent.get(task.id) ?? []) {
      walk(child, depth + 1)
    }
  }

  for (const root of byParent.get(null) ?? []) {
    walk(root, 0)
  }

  return { rows, matchedCount }
}

/** 相对区块内列表基线的缩进（每层两个空格） */
export function summaryTreeIndent(depth: number): string {
  return '  '.repeat(Math.max(0, depth))
}

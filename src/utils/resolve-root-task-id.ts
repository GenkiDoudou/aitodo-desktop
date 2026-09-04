import type { Task } from '@shared/types'

/**
 * 沿 parentId 向上找到根任务 id。
 * 列表点子任务时应打开父任务详情/编辑，避免每个子节点单独进详情。
 */
export function resolveRootTaskId(taskId: string, tasks: Task[]): string {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  let current = byId.get(taskId)
  if (!current) return taskId

  const seen = new Set<string>()
  while (current.parentId) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    const parent = byId.get(current.parentId)
    if (!parent) return current.parentId
    current = parent
  }
  return current.id
}

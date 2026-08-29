import type { Task } from './types'

/** 多选「显示清单」里代表未分类任务的哨兵值，与已完成页 uncategorized 对齐 */
export const UNCATEGORIZED_LIST_KEY = 'uncategorized'

/**
 * 判断任务是否应出现在所选清单范围内。
 *
 * @param task 待判断任务
 * @param selectedKeys 选中的清单 id，可含 {@link UNCATEGORIZED_LIST_KEY}；空数组表示不过滤
 * @param taskById 用于沿 parentId 查找祖先（子任务可没有自己的 categoryId）
 */
export function taskMatchesSelectedLists(
  task: Task,
  selectedKeys: readonly string[],
  taskById: ReadonlyMap<string, Task>
): boolean {
  if (selectedKeys.length === 0) return true
  const selected = new Set(selectedKeys)
  let current: Task | undefined = task
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (!current.categoryId) {
      if (selected.has(UNCATEGORIZED_LIST_KEY)) return true
    } else if (selected.has(current.categoryId)) {
      return true
    }
    current = current.parentId ? taskById.get(current.parentId) : undefined
  }
  return false
}

/**
 * 按所选清单过滤任务列表。空选择原样返回。
 *
 * @param tasks 待过滤集合
 * @param selectedKeys 同 {@link taskMatchesSelectedLists}
 * @param taskById 祖先查找表；缺省时用 tasks 自身建表
 */
export function filterTasksBySelectedLists(
  tasks: Task[],
  selectedKeys: readonly string[],
  taskById?: ReadonlyMap<string, Task>
): Task[] {
  if (selectedKeys.length === 0) return tasks
  const lookup = taskById ?? new Map(tasks.map((item) => [item.id, item]))
  return tasks.filter((item) => taskMatchesSelectedLists(item, selectedKeys, lookup))
}

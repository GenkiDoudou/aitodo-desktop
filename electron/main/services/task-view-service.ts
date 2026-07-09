import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import {
  matchTask,
  validateFilterNode,
  type FilterNode,
  type TaskFilterAstContext
} from '@shared/task-filter-ast'
import type {
  CreateTaskViewDto,
  Task,
  TaskView,
  UpdateTaskViewDto
} from '@shared/types'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import type { TaskViewLayout } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { AppError } from '@shared/types'
import type { TaskViewRepository } from '../db/task-view-repository'
import type { TaskRepository } from '../db/task-repository'

const LAYOUTS: TaskViewLayout[] = ['list', 'kanban', 'timeline']
const GROUP_BY: TaskGroupBy[] = ['custom', 'time', 'tag', 'priority', 'none']
const SORT_BY: TaskSortBy[] = ['custom', 'time', 'title', 'tag', 'priority']

export class TaskViewService {
  constructor(
    private readonly repo: TaskViewRepository,
    private readonly taskRepo?: TaskRepository
  ) {}

  list(): TaskView[] {
    return this.repo.list()
  }

  get(id: string): TaskView {
    const v = this.repo.findById(id)
    if (!v) throw new AppError('NOT_FOUND', '视图不存在')
    return v
  }

  create(dto: CreateTaskViewDto): TaskView {
    const name = dto.name?.trim()
    if (!name) throw new AppError('VALIDATION_ERROR', '视图名称不能为空')
    if (!LAYOUTS.includes(dto.layout)) {
      throw new AppError('VALIDATION_ERROR', '无效的布局类型')
    }
    const filterRule = dto.filterRule ?? null
    if (filterRule) {
      const ruleErr = validateFilterNode(filterRule)
      if (ruleErr) throw new AppError('VALIDATION_ERROR', ruleErr)
    }
    const groupBy = normalizeGroupBy(dto.groupBy)
    const sortBy = normalizeSortBy(dto.sortBy)
    const kanbanBoardMode = normalizeKanbanMode(dto.layout, dto.kanbanBoardMode)

    const ts = nowIso()
    const view: TaskView = {
      id: uuidv4(),
      name,
      layout: dto.layout,
      scopeKey: dto.scopeKey ?? null,
      filterRule,
      groupBy,
      sortBy,
      kanbanBoardMode,
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      createdAt: ts,
      updatedAt: ts
    }
    this.repo.insert(view)
    return this.get(view.id)
  }

  update(id: string, dto: UpdateTaskViewDto): TaskView {
    const existing = this.get(id)
    const layout = dto.layout ?? existing.layout
    if (dto.layout !== undefined && !LAYOUTS.includes(dto.layout)) {
      throw new AppError('VALIDATION_ERROR', '无效的布局类型')
    }
    const filterRule = dto.filterRule !== undefined ? dto.filterRule : existing.filterRule
    if (filterRule) {
      const ruleErr = validateFilterNode(filterRule)
      if (ruleErr) throw new AppError('VALIDATION_ERROR', ruleErr)
    }
    const name = dto.name !== undefined ? dto.name.trim() : existing.name
    if (!name) throw new AppError('VALIDATION_ERROR', '视图名称不能为空')

    const updated: TaskView = {
      ...existing,
      name,
      layout,
      scopeKey: dto.scopeKey !== undefined ? dto.scopeKey : existing.scopeKey,
      filterRule,
      groupBy: dto.groupBy !== undefined ? normalizeGroupBy(dto.groupBy) : existing.groupBy,
      sortBy: dto.sortBy !== undefined ? normalizeSortBy(dto.sortBy) : existing.sortBy,
      kanbanBoardMode:
        dto.kanbanBoardMode !== undefined
          ? normalizeKanbanMode(layout, dto.kanbanBoardMode)
          : layout === 'kanban'
            ? existing.kanbanBoardMode ?? 'group'
            : null,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.repo.update(updated)
    return this.get(id)
  }

  delete(id: string): void {
    this.get(id)
    this.repo.delete(id)
  }

  /** 按模板名插入；重名则后缀 (2)、(3)... */
  createFromPreset(preset: CreateTaskViewDto, baseName?: string): TaskView | null {
    const desired = (baseName ?? preset.name).trim()
    if (!desired) return null
    let name = desired
    let n = 2
    while (this.repo.findByName(name)) {
      name = `${desired} (${n})`
      n++
      if (n > 99) return null
    }
    return this.create({ ...preset, name })
  }

  previewCount(rule: FilterNode, ctx?: TaskFilterAstContext): number {
    const ruleErr = validateFilterNode(rule)
    if (ruleErr) throw new AppError('VALIDATION_ERROR', ruleErr)
    if (!this.taskRepo) return 0
    const tasks = this.taskRepo.list({ hideDone: false, smartList: 'all' })
    const hasSubtasksById = buildHasSubtasksMap(tasks)
    return tasks.filter((t) => matchTask(t, rule, { ...ctx, hasSubtasksById })).length
  }
}

function normalizeGroupBy(value?: TaskGroupBy): TaskGroupBy {
  if (value && GROUP_BY.includes(value)) return value
  return 'none'
}

function normalizeSortBy(value?: TaskSortBy): TaskSortBy {
  if (value && SORT_BY.includes(value)) return value
  return 'custom'
}

function normalizeKanbanMode(
  layout: TaskViewLayout,
  mode?: KanbanBoardMode | null
): KanbanBoardMode | null {
  if (layout !== 'kanban') return null
  return mode === 'status' ? 'status' : 'group'
}

function buildHasSubtasksMap(tasks: Task[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const t of tasks) {
    if (t.parentId) map.set(t.parentId, true)
  }
  return map
}

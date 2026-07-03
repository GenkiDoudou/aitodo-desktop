import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import {
  KANBAN_UNGROUPED_ID,
  isKanbanUngroupedMetaId,
  kanbanUngroupedMetaId
} from '@shared/kanban-scope'
import type {
  CreateKanbanGroupDto,
  KanbanBoardGroupsResult,
  KanbanGroup,
  UpdateKanbanGroupDto
} from '@shared/types'
import { AppError } from '@shared/types'
import type { KanbanGroupRepository } from '../db/kanban-group-repository'

export class KanbanGroupService {
  constructor(private readonly repo: KanbanGroupRepository) {}

  /** 返回自定义列与未分组显示名（未分组列本身不入 groups） */
  listBoard(scopeKey: string): KanbanBoardGroupsResult {
    if (!scopeKey?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'scopeKey 不能为空')
    }
    const all = this.repo.listByScope(scopeKey)
    const meta = all.find((g) => isKanbanUngroupedMetaId(g.id))
    const groups = all.filter((g) => !isKanbanUngroupedMetaId(g.id))
    return { groups, ungroupedName: meta?.name ?? '未分组' }
  }

  list(scopeKey: string): KanbanGroup[] {
    return this.listBoard(scopeKey).groups
  }

  create(dto: CreateKanbanGroupDto): KanbanGroup {
    const name = dto.name?.trim()
    if (!name) {
      throw new AppError('VALIDATION_ERROR', '分组名称不能为空')
    }
    const scopeKey = dto.scopeKey?.trim()
    if (!scopeKey) {
      throw new AppError('VALIDATION_ERROR', 'scopeKey 不能为空')
    }

    const ts = nowIso()
    let sortOrder = this.repo.maxCustomSortOrder(scopeKey) + 1

    if (dto.refGroupId === KANBAN_UNGROUPED_ID) {
      if (dto.position === 'before') {
        throw new AppError('VALIDATION_ERROR', '未分组左侧不能添加分组')
      }
      if (dto.position === 'after') {
        sortOrder = 0
        this.repo.shiftSortOrders(scopeKey, 0, 1)
      }
    } else if (dto.position === 'before' && dto.refGroupId) {
      const ref = this.repo.findById(dto.refGroupId)
      if (!ref || ref.scopeKey !== scopeKey || isKanbanUngroupedMetaId(ref.id)) {
        throw new AppError('NOT_FOUND', '参考分组不存在')
      }
      sortOrder = ref.sortOrder
      this.repo.shiftSortOrders(scopeKey, sortOrder, 1)
    } else if (dto.position === 'after' && dto.refGroupId) {
      const ref = this.repo.findById(dto.refGroupId)
      if (!ref || ref.scopeKey !== scopeKey || isKanbanUngroupedMetaId(ref.id)) {
        throw new AppError('NOT_FOUND', '参考分组不存在')
      }
      sortOrder = ref.sortOrder + 1
      this.repo.shiftSortOrders(scopeKey, sortOrder, 1)
    }

    const group: KanbanGroup = {
      id: uuidv4(),
      scopeKey,
      name,
      sortOrder,
      createdAt: ts,
      updatedAt: ts
    }
    this.repo.insert(group)
    return group
  }

  update(id: string, dto: UpdateKanbanGroupDto): KanbanGroup {
    if (id === KANBAN_UNGROUPED_ID) {
      const scopeKey = dto.scopeKey?.trim()
      if (!scopeKey) {
        throw new AppError('VALIDATION_ERROR', '重命名未分组需要 scopeKey')
      }
      const name = dto.name?.trim() || '未分组'
      return this.upsertUngroupedMeta(scopeKey, name)
    }

    const existing = this.repo.findById(id)
    if (!existing || isKanbanUngroupedMetaId(existing.id)) {
      throw new AppError('NOT_FOUND', '分组不存在')
    }
    const updated: KanbanGroup = {
      ...existing,
      name: dto.name?.trim() ? dto.name.trim() : existing.name,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    }
    this.repo.update(updated)
    return updated
  }

  delete(id: string): void {
    if (id === KANBAN_UNGROUPED_ID || isKanbanUngroupedMetaId(id)) {
      throw new AppError('VALIDATION_ERROR', '不能删除未分组')
    }
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分组不存在')
    }
    this.repo.clearTasksGroupId(id)
    this.repo.delete(id)
  }

  private upsertUngroupedMeta(scopeKey: string, name: string): KanbanGroup {
    const metaId = kanbanUngroupedMetaId(scopeKey)
    const ts = nowIso()
    const existing = this.repo.findById(metaId)
    if (existing) {
      const updated: KanbanGroup = { ...existing, name, updatedAt: ts }
      this.repo.update(updated)
      return updated
    }
    const group: KanbanGroup = {
      id: metaId,
      scopeKey,
      name,
      sortOrder: -1,
      createdAt: ts,
      updatedAt: ts
    }
    this.repo.insert(group)
    return group
  }
}

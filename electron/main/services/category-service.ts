import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import {
  findCategoryKeywordConflict,
  normalizeCategoryKeyword,
  normalizeCategoryKeywords
} from '@shared/category-keywords'
import type {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto
} from '@shared/types'
import { AppError } from '@shared/types'
import type { CategoryRepository } from '../db/category-repository'
import type { SyncOutbox } from '../db/sync-outbox'

function categoryPayload(category: Category): Record<string, unknown> {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    keywords: category.keywords,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt
  }
}

export class CategoryService {
  constructor(
    private readonly repo: CategoryRepository,
    private readonly outbox?: SyncOutbox
  ) {}

  list(): Category[] {
    return this.repo.list()
  }

  private withTx<T>(fn: () => T): T {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn()
  }

  private enqueueUpsert(category: Category, syncVersion: number): void {
    this.outbox?.record({
      entityType: 'category',
      entityId: category.id,
      operation: 'upsert',
      payload: categoryPayload(category),
      clientSyncVersion: syncVersion
    })
  }

  private assertKeywords(keywords: string[], excludeCategoryId?: string): string[] {
    const normalized = normalizeCategoryKeywords(keywords)
    for (const kw of normalized) {
      if (!normalizeCategoryKeyword(kw)) {
        throw new AppError('VALIDATION_ERROR', '关键词不能为空且不超过 32 字')
      }
    }
    const conflict = findCategoryKeywordConflict(normalized, this.repo.list(), excludeCategoryId)
    if (conflict) {
      throw new AppError('VALIDATION_ERROR', conflict)
    }
    return normalized
  }

  create(dto: CreateCategoryDto): Category {
    const title = dto.name?.trim()
    if (!title) {
      throw new AppError('VALIDATION_ERROR', '分类名称不能为空')
    }
    const keywords = this.assertKeywords(dto.keywords ?? [])
    const ts = nowIso()
    const category: Category = {
      id: uuidv4(),
      name: title,
      color: dto.color ?? '#409EFF',
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      keywords,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null
    }
    return this.withTx(() => {
      this.repo.insert(category)
      this.enqueueUpsert(category, 1)
      return category
    })
  }

  update(id: string, dto: UpdateCategoryDto): Category {
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    const keywords =
      dto.keywords !== undefined ? this.assertKeywords(dto.keywords, id) : existing.keywords
    const ts = nowIso()
    return this.withTx(() => {
      this.repo.update(id, {
        name: dto.name?.trim() ?? existing.name,
        color: dto.color !== undefined ? dto.color : existing.color,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        keywords,
        updatedAt: ts
      })
      const updated = this.repo.findById(id)!
      this.enqueueUpsert(updated, 1)
      return updated
    })
  }

  delete(id: string): void {
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    const ts = nowIso()
    this.withTx(() => {
      this.repo.clearTaskCategoryReferences(id, ts)
      this.repo.softDelete(id, ts)
      this.outbox?.record({
        entityType: 'category',
        entityId: id,
        operation: 'delete',
        payload: {
          id,
          deletedAt: ts,
          updatedAt: ts
        },
        clientSyncVersion: 1
      })
    })
  }

  /** 按 ids 顺序重写 sortOrder；未知 id 跳过；全非法则报错；空数组 no-op */
  reorder(ids: string[]): Category[] {
    if (!ids.length) return this.list()
    const existing = new Set(this.repo.list().map((c) => c.id))
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const id of ids) {
      if (!existing.has(id) || seen.has(id)) continue
      seen.add(id)
      ordered.push(id)
    }
    if (!ordered.length) {
      throw new AppError('VALIDATION_ERROR', '没有可排序的清单')
    }
    const ts = nowIso()
    return this.withTx(() => {
      ordered.forEach((id, index) => {
        this.repo.update(id, { sortOrder: index, updatedAt: ts })
        const updated = this.repo.findById(id)!
        this.enqueueUpsert(updated, 1)
      })
      return this.list()
    })
  }
}

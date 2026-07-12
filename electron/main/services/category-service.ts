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

export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  list(): Category[] {
    return this.repo.list()
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
      sortOrder: dto.sortOrder ?? 0,
      keywords,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null
    }
    this.repo.insert(category)
    return category
  }

  update(id: string, dto: UpdateCategoryDto): Category {
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    const keywords =
      dto.keywords !== undefined ? this.assertKeywords(dto.keywords, id) : existing.keywords
    const ts = nowIso()
    this.repo.update(id, {
      name: dto.name?.trim() ?? existing.name,
      color: dto.color !== undefined ? dto.color : existing.color,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      keywords,
      updatedAt: ts
    })
    return this.repo.findById(id)!
  }

  delete(id: string): void {
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    const ts = nowIso()
    this.repo.clearTaskCategoryReferences(id, ts)
    this.repo.softDelete(id, ts)
  }
}

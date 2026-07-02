import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
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

  create(dto: CreateCategoryDto): Category {
    const title = dto.name?.trim()
    if (!title) {
      throw new AppError('VALIDATION_ERROR', '分类名称不能为空')
    }
    const ts = nowIso()
    const category: Category = {
      id: uuidv4(),
      name: title,
      color: dto.color ?? '#409EFF',
      sortOrder: dto.sortOrder ?? 0,
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
    const ts = nowIso()
    this.repo.update(id, {
      name: dto.name?.trim() ?? existing.name,
      color: dto.color !== undefined ? dto.color : existing.color,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
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

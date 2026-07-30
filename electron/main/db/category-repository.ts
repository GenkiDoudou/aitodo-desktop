import type Database from 'better-sqlite3'
import type { Category } from '@shared/types'
import { parseCategoryKeywordsJson, serializeCategoryKeywords } from '@shared/category-keywords'

interface CategoryRow {
  id: string
  name: string
  color: string | null
  sort_order: number
  keywords: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    keywords: parseCategoryKeywordsJson(row.keywords),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  }
}

export class CategoryRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Category[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`
      )
      .all() as CategoryRow[]
    return rows.map(mapRow)
  }

  maxSortOrder(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) as mx FROM categories WHERE deleted_at IS NULL`
      )
      .get() as { mx: number }
    return row.mx
  }

  findById(id: string): Category | null {
    const row = this.db
      .prepare(`SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as CategoryRow | undefined
    return row ? mapRow(row) : null
  }

  insert(category: Category): void {
    this.db
      .prepare(
        `INSERT INTO categories (id, name, color, sort_order, keywords, created_at, updated_at, deleted_at)
         VALUES (@id, @name, @color, @sortOrder, @keywords, @createdAt, @updatedAt, NULL)`
      )
      .run({
        id: category.id,
        name: category.name,
        color: category.color,
        sortOrder: category.sortOrder,
        keywords: serializeCategoryKeywords(category.keywords),
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      })
  }

  update(
    id: string,
    fields: Partial<Pick<Category, 'name' | 'color' | 'sortOrder' | 'keywords' | 'updatedAt'>>
  ): void {
    const existing = this.findById(id)
    if (!existing) {
      return
    }
    const next = {
      name: fields.name ?? existing.name,
      color: fields.color !== undefined ? fields.color : existing.color,
      sortOrder: fields.sortOrder ?? existing.sortOrder,
      keywords:
        fields.keywords !== undefined
          ? serializeCategoryKeywords(fields.keywords)
          : serializeCategoryKeywords(existing.keywords),
      updatedAt: fields.updatedAt ?? existing.updatedAt
    }
    this.db
      .prepare(
        `UPDATE categories SET name = @name, color = @color, sort_order = @sortOrder, keywords = @keywords, updated_at = @updatedAt WHERE id = @id`
      )
      .run({ id, ...next })
  }

  softDelete(id: string, deletedAt: string): void {
    this.db.prepare(`UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(deletedAt, deletedAt, id)
  }

  /** 软删除分类时，将关联任务的 category_id 置空 */
  clearTaskCategoryReferences(categoryId: string, updatedAt: string): void {
    this.db
      .prepare(
        `UPDATE tasks SET category_id = NULL, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL`
      )
      .run(updatedAt, categoryId)
  }
}

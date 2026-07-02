import type Database from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import fs from 'fs'
import { getDatabaseFilePath, isDirectoryWritable, resolveDataDir } from '../data-path'
import { runMigrations } from './migrations'

let dbInstance: Database.Database | null = null
let activeDataDir: string | null = null

export class DatabaseNotWritableError extends Error {
  readonly code = 'DB_NOT_WRITABLE'

  constructor(public readonly dataPath: string) {
    super(`数据目录不可写：${dataPath}`)
    this.name = 'DatabaseNotWritableError'
  }
}

/**
 * 获取 Main 进程 SQLite 单例。
 * 首次调用时创建目录、校验写权限、启用 WAL 并执行迁移。
 */
export function getDatabase(): Database.Database {
  const dataDir = resolveDataDir()
  if (dbInstance && activeDataDir === dataDir) {
    return dbInstance
  }
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }

  if (!isDirectoryWritable(dataDir)) {
    throw new DatabaseNotWritableError(dataDir)
  }

  const dbPath = getDatabaseFilePath(dataDir)
  fs.mkdirSync(dataDir, { recursive: true })
  dbInstance = new BetterSqlite3(dbPath)
  dbInstance.pragma('journal_mode = WAL')
  runMigrations(dbInstance)
  activeDataDir = dataDir
  return dbInstance
}

export function getActiveDataDir(): string {
  return activeDataDir ?? resolveDataDir()
}

/** 测试或进程退出时关闭连接 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
    activeDataDir = null
  }
}

/** 供 Vitest 注入内存库 */
export function initDatabaseForTest(database: Database.Database): void {
  dbInstance = database
  activeDataDir = ':memory:'
  runMigrations(database)
}

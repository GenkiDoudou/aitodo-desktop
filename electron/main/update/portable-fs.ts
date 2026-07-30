import { createHash } from 'crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { PORTABLE_DATA_DIR_NAME } from './install-shape-detector'

/** 替换程序文件时必须跳过的目录/文件名 */
export const PORTABLE_PRESERVE_NAMES = new Set([
  PORTABLE_DATA_DIR_NAME,
  '.aitodo-update-pending.json',
  '.aitodo-update-staging'
])

export function shouldPreservePortableEntry(name: string): boolean {
  return PORTABLE_PRESERVE_NAMES.has(name) || name.startsWith('.aitodo-update')
}

export function sha512FileBase64(filePath: string, readFile: (p: string) => Buffer): string {
  const hash = createHash('sha512')
  hash.update(readFile(filePath))
  return hash.digest('base64')
}

export function assertSha512Match(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error('更新包校验失败（sha512 不匹配）')
  }
}

export interface PortablePendingMarker {
  version: string
  stagingDir: string
  createdAt: string
}

/**
 * 将 staging 中的程序文件合并到 appRoot，跳过 data/ 等保留项。
 * staging 内若误含 data/，也会被跳过，不会覆盖用户数据。
 */
export function applyPortableStaging(appRoot: string, stagingDir: string): void {
  if (!existsSync(stagingDir)) {
    throw new Error(`staging 不存在: ${stagingDir}`)
  }
  const contentRoot = resolveZipContentRoot(stagingDir)
  const names = readdirSync(contentRoot)
  for (const name of names) {
    if (shouldPreservePortableEntry(name)) continue
    const from = join(contentRoot, name)
    const to = join(appRoot, name)
    const st = statSync(from)
    if (st.isDirectory()) {
      if (existsSync(to)) {
        rmSync(to, { recursive: true, force: true })
      }
      cpSync(from, to, { recursive: true })
    } else {
      copyFileSync(from, to)
    }
  }
}

/**
 * zip 可能多一层目录（如 win-unpacked/）；若根下只有一个目录且含 exe/resources，则进入该层。
 */
export function resolveZipContentRoot(stagingDir: string): string {
  const names = readdirSync(stagingDir).filter((n) => n !== '__MACOSX')
  if (names.length === 1) {
    const only = join(stagingDir, names[0]!)
    if (statSync(only).isDirectory()) {
      const inner = readdirSync(only)
      if (inner.includes('resources') || inner.some((n) => n.endsWith('.exe'))) {
        return only
      }
    }
  }
  return stagingDir
}

/** 将旧 appRoot 下的 data/ move 到目标目录（优先 rename） */
export function moveDataDirIfNeeded(fromAppRoot: string, toAppRoot: string): void {
  if (fromAppRoot === toAppRoot) return
  const from = join(fromAppRoot, PORTABLE_DATA_DIR_NAME)
  const to = join(toAppRoot, PORTABLE_DATA_DIR_NAME)
  if (!existsSync(from)) return
  if (existsSync(to)) return
  try {
    renameSync(from, to)
  } catch {
    cpSync(from, to, { recursive: true })
  }
}

export function ensureEmptyDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
}

export function writePendingMarker(filePath: string, marker: PortablePendingMarker): void {
  writeFileSync(filePath, JSON.stringify(marker, null, 2), 'utf8')
}

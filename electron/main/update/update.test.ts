import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectInstallShape, hasNsisUninstaller } from './install-shape-detector'
import {
  applyPortableStaging,
  shouldPreservePortableEntry,
  resolveZipContentRoot,
  withNoAsar
} from './portable-fs'
import { compareSemver, parseUpdateYml } from './update-yml'
import { FeedResolver } from './feed-resolver'

describe('detectInstallShape', () => {
  it('returns mac on darwin', () => {
    expect(
      detectInstallShape({ platform: 'darwin', isPackaged: true, execPath: '/Apps/A.app/MacOS/A' })
    ).toBe('mac')
  })

  it('returns portable-dir for unpackaged win', () => {
    expect(
      detectInstallShape({ platform: 'win32', isPackaged: false, execPath: 'C:\\dev\\app.exe' })
    ).toBe('portable-dir')
  })

  it('detects nsis via Uninstall exe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aitodo-nsis-'))
    writeFileSync(join(dir, 'Uninstall 小柒todo.exe'), '')
    writeFileSync(join(dir, '小柒todo.exe'), '')
    expect(hasNsisUninstaller(dir)).toBe(true)
    expect(
      detectInstallShape({
        platform: 'win32',
        isPackaged: true,
        execPath: join(dir, '小柒todo.exe')
      })
    ).toBe('nsis')
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns portable-dir when no uninstaller', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aitodo-port-'))
    writeFileSync(join(dir, '小柒todo.exe'), '')
    expect(
      detectInstallShape({
        platform: 'win32',
        isPackaged: true,
        execPath: join(dir, '小柒todo.exe')
      })
    ).toBe('portable-dir')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('parseUpdateYml / compareSemver', () => {
  it('parses version path sha512', () => {
    const m = parseUpdateYml(`version: 1.2.3\npath: app-1.2.3-win.zip\nsha512: abc=\n`)
    expect(m).toEqual({
      version: '1.2.3',
      path: 'app-1.2.3-win.zip',
      sha512: 'abc=',
      parts: []
    })
  })

  it('parses ordered part lines', () => {
    const m = parseUpdateYml(
      `version: 1.0.0\npath: a.zip\nsha512: x=\npart: a.zip.part01\npart: a.zip.part02\n`
    )
    expect(m.parts).toEqual(['a.zip.part01', 'a.zip.part02'])
  })

  it('compares semver', () => {
    expect(compareSemver('1.1.0', '1.0.9')).toBe(1)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
  })
})

describe('FeedResolver', () => {
  it('resolves nsis feed from GitHub only', async () => {
    const calls: string[] = []
    const resolver = new FeedResolver({
      config: {
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        calls.push(url)
        if (url.includes('gitee.com')) throw new Error('should not hit gitee')
        if (url.endsWith('latest.yml')) {
          return 'version: 1.1.0\npath: Setup.exe\nsha512: xyz=\n'
        }
        throw new Error(`unexpected ${url}`)
      }
    })
    const feed = await resolver.resolve('nsis')
    expect(feed.source).toBe('github')
    expect(feed.manifest.version).toBe('1.1.0')
    expect(feed.assetUrl).toContain('github.com')
    expect(feed.assetUrl).toContain('Setup.exe')
    expect(feed.partUrls).toEqual([])
    expect(calls.every((u) => u.includes('github.com'))).toBe(true)
  })

  it('resolves portable parts from GitHub when listed in yml', async () => {
    const resolver = new FeedResolver({
      config: {
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com')) throw new Error('should not hit gitee')
        if (url.endsWith('latest-portable.yml')) {
          return 'version: 1.0.0\npath: a.zip\nsha512: zz=\npart: a.zip.part01\npart: a.zip.part02\n'
        }
        throw new Error(url)
      }
    })
    const feed = await resolver.resolve('portable')
    expect(feed.source).toBe('github')
    // GitHub resolveAsset 总是返回直链；有 path 时优先整包
    expect(feed.assetUrl).toContain('a.zip')
    expect(feed.partUrls).toEqual([])
  })

  it('uses GitHub latest download base', async () => {
    const resolver = new FeedResolver({
      config: {
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('github.com') && url.endsWith('latest-portable.yml')) {
          return 'version: 2.0.0\npath: app-2.0.0-win.zip\nsha512: qq=\n'
        }
        throw new Error(`unexpected ${url}`)
      }
    })
    const feed = await resolver.resolve('portable')
    expect(feed.source).toBe('github')
    expect(feed.manifest.path).toBe('app-2.0.0-win.zip')
    expect(feed.baseUrl).toBe('https://github.com/o/r/releases/latest/download/')
  })
})

describe('portable-fs data preservation', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs.length = 0
  })

  it('withNoAsar temporarily sets process.noAsar and restores previous value', () => {
    const proc = process as NodeJS.Process & { noAsar?: boolean }
    const before = proc.noAsar
    proc.noAsar = false
    const seen = withNoAsar(() => proc.noAsar)
    expect(seen).toBe(true)
    expect(proc.noAsar).toBe(false)
    proc.noAsar = before
  })

  it('preserves data name in exclude list', () => {
    expect(shouldPreservePortableEntry('data')).toBe(true)
    expect(shouldPreservePortableEntry('resources')).toBe(false)
  })

  it('applyPortableStaging skips data directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'aitodo-apply-'))
    dirs.push(root)
    const appRoot = join(root, 'app')
    const staging = join(root, 'staging')
    mkdirSync(appRoot)
    mkdirSync(staging)
    writeFileSync(join(appRoot, 'old.exe'), 'old')
    mkdirSync(join(appRoot, 'data'))
    writeFileSync(join(appRoot, 'data', 'data.db'), 'USERDB')
    writeFileSync(join(staging, 'new.exe'), 'new')
    mkdirSync(join(staging, 'data'))
    writeFileSync(join(staging, 'data', 'data.db'), 'SHOULD_NOT_OVERWRITE')
    writeFileSync(join(staging, 'resources.pak'), 'pak')

    applyPortableStaging(appRoot, staging)

    expect(readFileSync(join(appRoot, 'data', 'data.db'), 'utf8')).toBe('USERDB')
    expect(readFileSync(join(appRoot, 'new.exe'), 'utf8')).toBe('new')
    expect(existsSync(join(appRoot, 'resources.pak'))).toBe(true)
  })

  it('resolveZipContentRoot unwraps single nested folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'aitodo-ziproot-'))
    dirs.push(root)
    const nested = join(root, 'win-unpacked')
    mkdirSync(nested)
    mkdirSync(join(nested, 'resources'))
    writeFileSync(join(nested, 'app.exe'), '')
    expect(resolveZipContentRoot(root)).toBe(nested)
  })
})

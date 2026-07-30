import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectInstallShape, hasNsisUninstaller } from './install-shape-detector'
import {
  applyPortableStaging,
  shouldPreservePortableEntry,
  resolveZipContentRoot
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
    expect(m).toEqual({ version: '1.2.3', path: 'app-1.2.3-win.zip', sha512: 'abc=' })
  })

  it('compares semver', () => {
    expect(compareSemver('1.1.0', '1.0.9')).toBe(1)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
  })
})

describe('FeedResolver', () => {
  it('uses gitee when it succeeds', async () => {
    const calls: string[] = []
    const resolver = new FeedResolver({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        calls.push(url)
        if (url.includes('gitee.com/api')) {
          return JSON.stringify({
            assets: [
              {
                name: 'latest.yml',
                browser_download_url: 'https://gitee.com/o/r/releases/download/v1.1.0/latest.yml'
              },
              {
                name: 'Setup.exe',
                browser_download_url: 'https://gitee.com/o/r/releases/download/v1.1.0/Setup.exe'
              }
            ]
          })
        }
        if (url.endsWith('latest.yml')) {
          return 'version: 1.1.0\npath: Setup.exe\nsha512: xyz=\n'
        }
        throw new Error(`unexpected ${url}`)
      }
    })
    const feed = await resolver.resolve('nsis')
    expect(feed.source).toBe('gitee')
    expect(feed.manifest.version).toBe('1.1.0')
    expect(feed.assetUrl).toContain('Setup.exe')
    expect(calls.some((u) => u.includes('github.com'))).toBe(false)
  })

  it('falls back to github when gitee fails', async () => {
    const resolver = new FeedResolver({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com')) throw new Error('gitee down')
        if (url.includes('github.com') && url.endsWith('latest-portable.yml')) {
          return 'version: 2.0.0\npath: app-2.0.0-win.zip\nsha512: qq=\n'
        }
        throw new Error(`unexpected ${url}`)
      }
    })
    const feed = await resolver.resolve('portable')
    expect(feed.source).toBe('github')
    expect(feed.manifest.path).toBe('app-2.0.0-win.zip')
  })
})

describe('portable-fs data preservation', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs.length = 0
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

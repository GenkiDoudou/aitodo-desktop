import { createHash } from 'crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { FeedResolver } from './feed-resolver'
import { PortableZipUpdater } from './portable-zip-updater'
import { portablePendingPath, resolveAppRootDir } from './install-shape-detector'

describe('PortableZipUpdater (mocked feed)', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    dirs.length = 0
  })

  it('reports up-to-date without writing pending when version is current', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aitodo-pzip-'))
    dirs.push(root)
    const appRoot = join(root, 'app')
    mkdirSync(appRoot)
    writeFileSync(join(appRoot, 'app.exe'), 'old')
    mkdirSync(join(appRoot, 'data'))
    writeFileSync(join(appRoot, 'data', 'data.db'), 'KEEP')

    const zipName = 'app-9.9.9-win.zip'
    const payload = Buffer.from('fake-zip-bytes')
    const sha512 = createHash('sha512').update(payload).digest('base64')

    const resolver = new FeedResolver({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com/api')) {
          return JSON.stringify({
            assets: [
              {
                name: 'latest-portable.yml',
                browser_download_url:
                  'https://gitee.com/o/r/releases/download/v9.9.9/latest-portable.yml'
              },
              {
                name: zipName,
                browser_download_url: `https://gitee.com/o/r/releases/download/v9.9.9/${zipName}`
              }
            ]
          })
        }
        if (url.endsWith('latest-portable.yml')) {
          return `version: 9.9.9\npath: ${zipName}\nsha512: ${sha512}\n`
        }
        throw new Error(url)
      }
    })

    const events: string[] = []
    const updater = new PortableZipUpdater({
      feedResolver: resolver,
      getCurrentVersion: () => '9.9.9',
      getExecPath: () => join(appRoot, 'app.exe')
    })
    updater.setHooks({ onUpToDate: () => events.push('up-to-date') })
    await updater.checkAndDownload()
    expect(events).toContain('up-to-date')
    expect(existsSync(portablePendingPath(appRoot))).toBe(false)
    expect(readFileSync(join(appRoot, 'data', 'data.db'), 'utf8')).toBe('KEEP')
    expect(resolveAppRootDir(join(appRoot, 'app.exe'))).toBe(appRoot)
  })

  it('rejects mismatched sha512 and leaves data intact', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aitodo-pzip-bad-'))
    dirs.push(root)
    const appRoot = join(root, 'app')
    mkdirSync(appRoot)
    writeFileSync(join(appRoot, 'app.exe'), 'old')
    mkdirSync(join(appRoot, 'data'))
    writeFileSync(join(appRoot, 'data', 'data.db'), 'KEEP')

    const resolver = new FeedResolver({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com/api')) {
          return JSON.stringify({
            assets: [
              {
                name: 'latest-portable.yml',
                browser_download_url:
                  'https://gitee.com/o/r/releases/download/v2.0.0/latest-portable.yml'
              },
              {
                name: 'x.zip',
                browser_download_url: 'https://gitee.com/o/r/releases/download/v2.0.0/x.zip'
              }
            ]
          })
        }
        if (url.endsWith('latest-portable.yml')) {
          return 'version: 2.0.0\npath: x.zip\nsha512: not-the-real-hash=\n'
        }
        throw new Error(url)
      }
    })

    const updater = new PortableZipUpdater({
      feedResolver: resolver,
      getCurrentVersion: () => '1.0.0',
      getExecPath: () => join(appRoot, 'app.exe'),
      downloadToFile: async (_url, dest) => {
        mkdirSync(join(dest, '..'), { recursive: true })
        writeFileSync(dest, Buffer.from('bytes'))
      }
    })

    await expect(updater.checkAndDownload()).rejects.toThrow(/sha512/)
    expect(existsSync(portablePendingPath(appRoot))).toBe(false)
    expect(readFileSync(join(appRoot, 'data', 'data.db'), 'utf8')).toBe('KEEP')
  })
})

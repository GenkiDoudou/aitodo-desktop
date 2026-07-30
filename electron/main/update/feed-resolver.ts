import type { UpdateFeedSource } from '@shared/app-update'
import { getUpdateFeedConfig, type UpdateFeedConfig } from './update-feed-config'
import { parseUpdateYml, type UpdateManifest } from './update-yml'

export type FeedManifestKind = 'nsis' | 'mac' | 'portable'

export interface ResolvedFeed {
  source: UpdateFeedSource
  /** generic provider 目录 URL（以 / 结尾） */
  baseUrl: string
  manifest: UpdateManifest
  /** 资源直链 */
  assetUrl: string
}

export type FetchText = (url: string) => Promise<string>

const MANIFEST_FILE: Record<FeedManifestKind, string> = {
  nsis: 'latest.yml',
  mac: 'latest-mac.yml',
  portable: 'latest-portable.yml'
}

export interface FeedResolverOptions {
  config?: UpdateFeedConfig
  fetchText?: FetchText
}

/**
 * 双源 feed：先 Gitee 后 GitHub；单次 resolve 内源固定。
 */
export class FeedResolver {
  private readonly config: UpdateFeedConfig
  private readonly fetchText: FetchText

  constructor(options: FeedResolverOptions = {}) {
    this.config = options.config ?? getUpdateFeedConfig()
    this.fetchText = options.fetchText ?? defaultFetchText
  }

  async resolve(kind: FeedManifestKind): Promise<ResolvedFeed> {
    const errors: string[] = []
    try {
      return await this.resolveFrom('gitee', kind)
    } catch (err) {
      errors.push(`gitee: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      return await this.resolveFrom('github', kind)
    } catch (err) {
      errors.push(`github: ${err instanceof Error ? err.message : String(err)}`)
    }
    throw new Error(`更新源均不可用：${errors.join(' | ')}`)
  }

  async resolveFrom(source: UpdateFeedSource, kind: FeedManifestKind): Promise<ResolvedFeed> {
    const manifestName = MANIFEST_FILE[kind]
    const { manifestUrl, baseUrl, assetUrlFor } = await this.resolveUrls(source, manifestName)
    const text = await this.fetchText(manifestUrl)
    const manifest = parseUpdateYml(text)
    return {
      source,
      baseUrl,
      manifest,
      assetUrl: assetUrlFor(manifest.path)
    }
  }

  private async resolveUrls(
    source: UpdateFeedSource,
    manifestName: string
  ): Promise<{
    manifestUrl: string
    baseUrl: string
    assetUrlFor: (fileName: string) => string
  }> {
    if (source === 'github') {
      const { owner, repo } = this.config.github
      const baseUrl = `https://github.com/${owner}/${repo}/releases/latest/download/`
      return {
        baseUrl,
        manifestUrl: `${baseUrl}${manifestName}`,
        assetUrlFor: (fileName) => `${baseUrl}${fileName}`
      }
    }

    const { owner, repo } = this.config.gitee
    const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/releases/latest`
    const raw = await this.fetchText(apiUrl)
    let release: { assets?: Array<{ name?: string; browser_download_url?: string }> }
    try {
      release = JSON.parse(raw) as typeof release
    } catch {
      throw new Error('Gitee release JSON 解析失败')
    }
    const assets = release.assets ?? []
    const manifestAsset = assets.find((a) => a.name === manifestName)
    if (!manifestAsset?.browser_download_url) {
      throw new Error(`Gitee release 缺少 ${manifestName}`)
    }
    const manifestUrl = manifestAsset.browser_download_url
    const slash = manifestUrl.lastIndexOf('/')
    const baseUrl = slash >= 0 ? manifestUrl.slice(0, slash + 1) : manifestUrl
    return {
      baseUrl,
      manifestUrl,
      assetUrlFor: (fileName) => {
        const hit = assets.find((a) => a.name === fileName)
        if (hit?.browser_download_url) return hit.browser_download_url
        return `${baseUrl}${fileName}`
      }
    }
  }
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'ai-todo-desktop-updater' }
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`)
  }
  return await res.text()
}

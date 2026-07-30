import type { UpdateFeedSource } from '@shared/app-update'
import { getUpdateFeedConfig, type UpdateFeedConfig } from './update-feed-config'
import { parseUpdateYml, type UpdateManifest } from './update-yml'

export type FeedManifestKind = 'nsis' | 'mac' | 'portable'

export interface ResolvedFeed {
  source: UpdateFeedSource
  /** generic provider 目录 URL（以 / 结尾） */
  baseUrl: string
  manifest: UpdateManifest
  /**
   * 整包直链。若源上只有分卷、没有完整 path 文件，则为 null，此时用 partUrls。
   */
  assetUrl: string | null
  /** 有序分卷直链；无分卷时为空数组 */
  partUrls: string[]
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
 * Gitee 可能因 100MB 限制只有分卷；GitHub 通常有完整 zip。
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
    const { manifestUrl, baseUrl, resolveAsset } = await this.resolveUrls(source, manifestName)
    const text = await this.fetchText(manifestUrl)
    const manifest = parseUpdateYml(text)
    const single = resolveAsset(manifest.path)
    const partUrls = manifest.parts.map((p) => {
      const url = resolveAsset(p)
      if (!url) throw new Error(`更新源缺少分卷 ${p}`)
      return url
    })

    if (!single && partUrls.length === 0) {
      throw new Error(`更新源缺少安装包 ${manifest.path}`)
    }
    if (!single && partUrls.length > 0 && manifest.parts.length === 0) {
      throw new Error(`更新源缺少安装包 ${manifest.path}`)
    }
    // 有分卷声明但源上既无整包也无齐套分卷
    if (!single && manifest.parts.length > 0 && partUrls.length !== manifest.parts.length) {
      throw new Error(`更新源分卷不完整`)
    }

    return {
      source,
      baseUrl,
      manifest,
      assetUrl: single,
      partUrls: single ? [] : partUrls
    }
  }

  private async resolveUrls(
    source: UpdateFeedSource,
    manifestName: string
  ): Promise<{
    manifestUrl: string
    baseUrl: string
    /** 返回 null 表示该源 release 资产列表里没有此文件 */
    resolveAsset: (fileName: string) => string | null
  }> {
    if (source === 'github') {
      const { owner, repo } = this.config.github
      const baseUrl = `https://github.com/${owner}/${repo}/releases/latest/download/`
      return {
        baseUrl,
        manifestUrl: `${baseUrl}${manifestName}`,
        // GitHub latest/download 对存在的文件直接可下；整包优先
        resolveAsset: (fileName) => `${baseUrl}${fileName}`
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
      resolveAsset: (fileName) => {
        const hit = assets.find((a) => a.name === fileName)
        return hit?.browser_download_url ?? null
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

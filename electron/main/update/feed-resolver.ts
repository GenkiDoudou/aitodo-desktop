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
 * 更新源：仅 GitHub Releases（latest/download）。
 * 分卷字段仍解析，便于清单兼容；GitHub 通常提供完整 zip。
 */
export class FeedResolver {
  private readonly config: UpdateFeedConfig
  private readonly fetchText: FetchText

  constructor(options: FeedResolverOptions = {}) {
    this.config = options.config ?? getUpdateFeedConfig()
    this.fetchText = options.fetchText ?? defaultFetchText
  }

  async resolve(kind: FeedManifestKind): Promise<ResolvedFeed> {
    return await this.resolveFrom('github', kind)
  }

  async resolveFrom(source: UpdateFeedSource, kind: FeedManifestKind): Promise<ResolvedFeed> {
    if (source !== 'github') {
      throw new Error(`不支持的更新源: ${source}`)
    }
    const manifestName = MANIFEST_FILE[kind]
    const { manifestUrl, baseUrl, resolveAsset } = this.resolveGithubUrls(manifestName)
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
    if (!single && manifest.parts.length > 0 && partUrls.length !== manifest.parts.length) {
      throw new Error(`更新源分卷不完整`)
    }

    return {
      source: 'github',
      baseUrl,
      manifest,
      assetUrl: single,
      partUrls: single ? [] : partUrls
    }
  }

  private resolveGithubUrls(manifestName: string): {
    manifestUrl: string
    baseUrl: string
    resolveAsset: (fileName: string) => string | null
  } {
    const { owner, repo } = this.config.github
    const baseUrl = `https://github.com/${owner}/${repo}/releases/latest/download/`
    return {
      baseUrl,
      manifestUrl: `${baseUrl}${manifestName}`,
      resolveAsset: (fileName) => `${baseUrl}${fileName}`
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

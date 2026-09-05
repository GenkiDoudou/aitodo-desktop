import type { UpdateFeedSource } from '@shared/app-update'
import { getUpdateFeedConfig, type UpdateFeedConfig } from './update-feed-config'
import { parseUpdateYml, type UpdateManifest } from './update-yml'

export type FeedManifestKind = 'nsis' | 'mac' | 'portable'

export interface ResolvedFeed {
  source: UpdateFeedSource
  /** generic provider 目录 URL（以 / 结尾） */
  baseUrl: string
  manifest: UpdateManifest
  /** 安装包 / zip 直链 */
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

/** 更新源：仅 GitHub Releases（latest/download），要求清单含完整 path 资产。 */
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
    const assetUrl = resolveAsset(manifest.path)
    if (!assetUrl) {
      throw new Error(`更新源缺少安装包 ${manifest.path}`)
    }

    return {
      source: 'github',
      baseUrl,
      manifest,
      assetUrl
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
      resolveAsset: (fileName) => {
        // 对文件名做百分号编码，避免空格/非 ASCII 导致 GitHub 直链 404
        const encoded = fileName
          .split('/')
          .map((seg) => encodeURIComponent(seg))
          .join('/')
        return `${baseUrl}${encoded}`
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

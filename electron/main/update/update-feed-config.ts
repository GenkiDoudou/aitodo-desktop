/**
 * 更新源仓库配置（开源公开仓，仅含 desktop/）。
 * 自动更新与发版资产仅使用 GitHub。
 * 可用环境变量覆盖（一般不必）。
 */
export interface UpdateRepoRef {
  owner: string
  repo: string
}

export interface UpdateFeedConfig {
  github: UpdateRepoRef
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : fallback
}

export function getUpdateFeedConfig(): UpdateFeedConfig {
  return {
    github: {
      owner: envOr('AITODO_UPDATE_GITHUB_OWNER', 'GenkiDoudou'),
      repo: envOr('AITODO_UPDATE_GITHUB_REPO', 'aitodo-desktop')
    }
  }
}

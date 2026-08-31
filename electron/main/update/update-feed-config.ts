/**
 * 更新源仓库配置（开源公开仓，仅含 desktop/）。
 * 默认：Gitee / GitHub 的 GenkiDoudou/aitodo-desktop
 * 可用环境变量覆盖（一般不必）。
 */
export interface UpdateRepoRef {
  owner: string
  repo: string
}

export interface UpdateFeedConfig {
  gitee: UpdateRepoRef
  github: UpdateRepoRef
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : fallback
}

export function getUpdateFeedConfig(): UpdateFeedConfig {
  return {
    gitee: {
      owner: envOr('AITODO_UPDATE_GITEE_OWNER', 'GenkiDoudou'),
      repo: envOr('AITODO_UPDATE_GITEE_REPO', 'aitodo-desktop')
    },
    github: {
      owner: envOr('AITODO_UPDATE_GITHUB_OWNER', 'GenkiDoudou'),
      repo: envOr('AITODO_UPDATE_GITHUB_REPO', 'aitodo-desktop')
    }
  }
}

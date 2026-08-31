# 将 monorepo 中 desktop/ 用 subtree 推送到两个开源仓。
# 目标:
#   https://github.com/GenkiDoudou/aitodo-desktop.git
#   https://gitee.com/GenkiDoudou/aitodo-desktop.git
# 可从 desktop/ 或仓库根执行。
# 默认：若 desktop/ 有未提交改动，会先自动 git add/commit 再 push（仅 desktop/）。
#
# 示例:
#   .\scripts\sync-opensource.ps1 -SetupRemotesOnly
#   .\scripts\sync-opensource.ps1
#   .\scripts\sync-opensource.ps1 -Remote github
#   .\scripts\sync-opensource.ps1 -NoAutoCommit
[CmdletBinding()]
param(
  [switch]$SetupRemotesOnly,
  [switch]$NoAutoCommit,
  [ValidateSet('both', 'github', 'gitee')]
  [string]$Remote = 'both'
)

$ErrorActionPreference = 'Stop'

function Find-RepoRoot {
  $dir = (Get-Location).Path
  if (Test-Path (Join-Path $dir 'desktop\package.json')) {
    return $dir
  }
  $parent = Split-Path $dir -Parent
  if ((Split-Path $dir -Leaf) -eq 'desktop' -and (Test-Path (Join-Path $parent 'desktop\package.json'))) {
    return $parent
  }
  throw "未找到 monorepo 根（需存在 desktop/package.json）。当前目录: $dir"
}

function Ensure-DesktopRemotes {
  param([string]$RepoRoot)
  Push-Location $RepoRoot
  try {
    $obsolete = git remote | Where-Object { $_ -eq 'gitee-ai-todo' }
    if ($obsolete) {
      git remote remove gitee-ai-todo
      Write-Host '[ok] removed obsolete remote gitee-ai-todo'
    }

    $remotes = @(git remote)
    $githubUrl = 'git@github.com:GenkiDoudou/aitodo-desktop.git'
    $giteeUrl = 'git@gitee.com:GenkiDoudou/aitodo-desktop.git'
    if ($remotes -notcontains 'desktop-github') {
      git remote add desktop-github $githubUrl
      Write-Host '[ok] added remote desktop-github (ssh)'
    } else {
      git remote set-url desktop-github $githubUrl
      Write-Host '[ok] desktop-github url -> ssh'
    }
    if ($remotes -notcontains 'desktop-gitee') {
      git remote add desktop-gitee $giteeUrl
      Write-Host '[ok] added remote desktop-gitee (ssh)'
    } else {
      git remote set-url desktop-gitee $giteeUrl
      Write-Host '[ok] desktop-gitee url -> ssh'
    }
  } finally {
    Pop-Location
  }
}

# 确保 desktop/ 已提交：默认自动 commit；-NoAutoCommit 时遇脏文件则失败。
function Ensure-DesktopCommitted {
  param(
    [string]$RepoRoot,
    [switch]$NoAutoCommit
  )
  Push-Location $RepoRoot
  try {
    $dirty = git status --porcelain -- desktop
    if (-not $dirty) {
      Write-Host '[ok] desktop/ clean'
      return
    }
    Write-Host $dirty
    if ($NoAutoCommit) {
      throw 'desktop/ has uncommitted changes. Commit first, or omit -NoAutoCommit to auto-commit.'
    }
    Write-Host '>>> auto-commit desktop/ before subtree push'
    git add -- desktop/
    if ($LASTEXITCODE -ne 0) {
      throw 'git add desktop/ failed'
    }
    $staged = git diff --cached --name-only -- desktop
    if (-not $staged) {
      throw 'desktop/ dirty but nothing staged after git add; check .gitignore'
    }
    git commit -m "chore(desktop): auto-commit before opensource sync"
    if ($LASTEXITCODE -ne 0) {
      throw 'auto-commit desktop/ failed'
    }
    Write-Host '[ok] auto-committed desktop/'
  } finally {
    Pop-Location
  }
}

function Push-Subtree {
  param(
    [string]$RepoRoot,
    [string]$RemoteName
  )
  Push-Location $RepoRoot
  try {
    Write-Host ">>> git subtree push --prefix=desktop $RemoteName main"
    git subtree push --prefix=desktop $RemoteName main
    if ($LASTEXITCODE -ne 0) {
      throw "subtree push to $RemoteName failed (exit $LASTEXITCODE)"
    }
    Write-Host "[ok] pushed desktop/ to $RemoteName main"
  } finally {
    Pop-Location
  }
}

$repoRoot = Find-RepoRoot
Write-Host "repo root: $repoRoot"
Write-Host 'targets: GitHub + Gitee GenkiDoudou/aitodo-desktop (desktop/ only)'

Ensure-DesktopRemotes -RepoRoot $repoRoot

if ($SetupRemotesOnly) {
  Write-Host 'remotes configured only; done.'
  exit 0
}

Ensure-DesktopCommitted -RepoRoot $repoRoot -NoAutoCommit:$NoAutoCommit

$targets = @()
if ($Remote -eq 'both' -or $Remote -eq 'github') { $targets += 'desktop-github' }
if ($Remote -eq 'both' -or $Remote -eq 'gitee') { $targets += 'desktop-gitee' }

foreach ($r in $targets) {
  Push-Subtree -RepoRoot $repoRoot -RemoteName $r
}

Write-Host ''
Write-Host 'Sync done. To release (tag + Actions build):'
Write-Host '  pnpm run release:opensource'
Write-Host '  or: .\scripts\release-opensource.ps1'

# 将 monorepo 中 desktop/ 用 subtree 推送到 GitHub 开源仓。
# 目标: https://github.com/GenkiDoudou/aitodo-desktop.git
# 可从 desktop/ 或仓库根执行。
# 默认：若 desktop/ 有未提交改动，会先自动 git add/commit 再 push（仅 desktop/）。
#
# 示例:
#   .\scripts\sync-opensource.ps1 -SetupRemotesOnly
#   .\scripts\sync-opensource.ps1
#   .\scripts\sync-opensource.ps1 -NoAutoCommit
#   .\scripts\sync-opensource.ps1 -Force   # 远程已分叉时强制以本地 desktop/ 覆盖
[CmdletBinding()]
param(
  [switch]$SetupRemotesOnly,
  [switch]$NoAutoCommit,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & git @GitArgs 2>&1
    return @{
      Output   = $out
      ExitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $oldEap
  }
}

function Write-GitOutput {
  param($Output)
  if ($null -eq $Output) { return }
  foreach ($line in $Output) {
    if ($null -ne $line) {
      Write-Host $line
    }
  }
}

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
    foreach ($name in @('gitee-ai-todo', 'desktop-gitee')) {
      $hit = git remote | Where-Object { $_ -eq $name }
      if ($hit) {
        git remote remove $name
        Write-Host ('[ok] removed obsolete remote {0}' -f $name)
      }
    }

    $remotes = @(git remote)
    $githubUrl = 'git@github.com:GenkiDoudou/aitodo-desktop.git'
    if ($remotes -notcontains 'desktop-github') {
      git remote add desktop-github $githubUrl
      Write-Host '[ok] added remote desktop-github (ssh)'
    } else {
      git remote set-url desktop-github $githubUrl
      Write-Host '[ok] desktop-github url -> ssh'
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

function Invoke-ForceSubtreePush {
  param(
    [string]$RepoRoot,
    [string]$RemoteName
  )
  $splitBranch = "subtree-split-$($RemoteName -replace '[^a-zA-Z0-9]', '-')-$(Get-Date -Format 'yyyyMMddHHmmss')"
  Push-Location $RepoRoot
  try {
    Write-Host ">>> git subtree split --prefix=desktop -b $splitBranch"
    $split = Invoke-Git subtree split --prefix=desktop -b $splitBranch
    Write-GitOutput $split.Output
    if ($split.ExitCode -ne 0) {
      throw 'subtree split failed'
    }
    Write-Host ">>> git push $RemoteName ${splitBranch}:main --force"
    $force = Invoke-Git push $RemoteName "${splitBranch}:main" --force
    Write-GitOutput $force.Output
    if ($force.ExitCode -ne 0) {
      throw "force push to $RemoteName failed (exit $($force.ExitCode))"
    }
    Write-Host "[ok] force-pushed desktop/ to $RemoteName main"
  } finally {
    git branch -D $splitBranch 2>$null | Out-Null
    Pop-Location
  }
}

function Push-Subtree {
  param(
    [string]$RepoRoot,
    [string]$RemoteName,
    [switch]$Force
  )
  Push-Location $RepoRoot
  try {
    Write-Host ">>> git subtree push --prefix=desktop $RemoteName main"
    $push = Invoke-Git subtree push --prefix=desktop $RemoteName main
    Write-GitOutput $push.Output
    if ($push.ExitCode -eq 0) {
      Write-Host "[ok] pushed desktop/ to $RemoteName main"
      return
    }

    $pushText = ($push.Output | Out-String)
    $diverged = $pushText -match 'non-fast-forward|\[rejected\]|rejected'
    if ($Force -or $diverged) {
      Write-Host "[warn] remote $RemoteName/main diverged or behind; force push (private monorepo desktop/ wins)"
      Invoke-ForceSubtreePush -RepoRoot $RepoRoot -RemoteName $RemoteName
      return
    }

    throw "subtree push to $RemoteName failed (exit $($push.ExitCode))"
  } finally {
    Pop-Location
  }
}

$repoRoot = Find-RepoRoot
Write-Host "repo root: $repoRoot"
Write-Host 'target: GitHub GenkiDoudou/aitodo-desktop (desktop/ only)'

Ensure-DesktopRemotes -RepoRoot $repoRoot

if ($SetupRemotesOnly) {
  Write-Host 'remotes configured only; done.'
  exit 0
}

Ensure-DesktopCommitted -RepoRoot $repoRoot -NoAutoCommit:$NoAutoCommit

Push-Subtree -RepoRoot $repoRoot -RemoteName 'desktop-github' -Force:$Force

Write-Host ''
Write-Host 'Sync done. To release (tag + Actions build):'
Write-Host '  pnpm run release:opensource'
Write-Host '  or: .\scripts\release-opensource.ps1'

# 将 desktop/ subtree 同步到开源仓，并打 v* tag，触发 GitHub Actions 打包（供自更新）。
# 目标仓:
#   https://github.com/GenkiDoudou/aitodo-desktop.git
#   https://gitee.com/GenkiDoudou/aitodo-desktop.git
# 默认会自动 commit desktop/ 未提交改动（含版本号 bump）。
#
# 示例:
#   .\scripts\release-opensource.ps1
#   .\scripts\release-opensource.ps1 -Version 1.1.0
#   .\scripts\release-opensource.ps1 -NoAutoCommit
[CmdletBinding()]
param(
  [string]$Version = '',
  [switch]$CommitBump,
  [switch]$NoAutoCommit,
  [switch]$Force,
  [switch]$SkipSync,
  [switch]$SkipTag,
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
  throw "未找到 monorepo 根。当前: $dir"
}

function Get-PackageVersion {
  param([string]$PackageJsonPath)
  $json = Get-Content -Raw -Encoding UTF8 $PackageJsonPath | ConvertFrom-Json
  return [string]$json.version
}

function Set-PackageVersion {
  param(
    [string]$PackageJsonPath,
    [string]$NewVersion
  )
  if ($NewVersion -notmatch '^\d+\.\d+\.\d+([.-][\w.]+)?$') {
    throw "invalid version: $NewVersion (expect 1.2.3)"
  }
  $raw = Get-Content -Raw -Encoding UTF8 $PackageJsonPath
  $updated = [regex]::Replace(
    $raw,
    '"version"\s*:\s*"[^"]+"',
    ('"version": "' + $NewVersion + '"'),
    1
  )
  if ($updated -eq $raw) {
    throw 'failed to replace version in package.json'
  }
  [System.IO.File]::WriteAllText($PackageJsonPath, $updated, [System.Text.UTF8Encoding]::new($false))
}

$repoRoot = Find-RepoRoot
$desktopDir = Join-Path $repoRoot 'desktop'
$packageJson = Join-Path $desktopDir 'package.json'
$syncScript = Join-Path $desktopDir 'scripts\sync-opensource.ps1'

if (-not (Test-Path $syncScript)) {
  throw "missing sync script: $syncScript"
}

$current = Get-PackageVersion -PackageJsonPath $packageJson
$target = if ($Version.Trim()) { $Version.Trim().TrimStart('v', 'V') } else { $current }

Write-Host "repo root: $repoRoot"
Write-Host "package.json version: $current"
Write-Host "release version: $target"

if ($target -ne $current) {
  Write-Host ">>> write package.json version -> $target"
  Set-PackageVersion -PackageJsonPath $packageJson -NewVersion $target
  if ($NoAutoCommit -and -not $CommitBump) {
    throw "package.json updated to $target but -NoAutoCommit set. Commit manually or omit -NoAutoCommit."
  }
  Push-Location $repoRoot
  try {
    git add -- desktop/package.json
    git commit -m "chore(desktop): bump version to $target"
    if ($LASTEXITCODE -ne 0) {
      throw 'auto commit version bump failed'
    }
    Write-Host '[ok] committed desktop/package.json version bump'
  } finally {
    Pop-Location
  }
}

$tag = "v$target"

if (-not $SkipSync) {
  Write-Host ">>> subtree sync desktop/ (Remote=$Remote)"
  $syncArgs = @{ Remote = $Remote }
  if ($NoAutoCommit) { $syncArgs.NoAutoCommit = $true }
  if ($Force) { $syncArgs.Force = $true }
  & $syncScript @syncArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'sync-opensource.ps1 failed'
  }
} else {
  Write-Host '[skip] subtree sync'
}

if ($SkipTag) {
  Write-Host '[skip] tagging. Later: .\scripts\release-opensource.ps1 -SkipSync'
  exit 0
}

Push-Location $repoRoot
try {
  & $syncScript -SetupRemotesOnly

  $tagRemotes = @()
  if ($Remote -eq 'both' -or $Remote -eq 'github') { $tagRemotes += 'desktop-github' }
  if ($Remote -eq 'both' -or $Remote -eq 'gitee') { $tagRemotes += 'desktop-gitee' }

  foreach ($r in $tagRemotes) {
    Write-Host ">>> fetch $r"
    git fetch $r main --tags
    if ($LASTEXITCODE -ne 0) {
      throw "fetch $r failed"
    }

    $tip = git rev-parse "$r/main"
    if (-not $tip) {
      throw "cannot resolve $r/main"
    }

    $existing = git tag -l $tag
    if ($existing) {
      $tagCommit = git rev-list -n 1 $tag
      if ($tagCommit -ne $tip) {
        throw "local tag $tag exists on other commit ($tagCommit != $tip). Delete local tag or use a new version."
      }
      Write-Host "[skip] local tag $tag already points at $r/main"
    } else {
      Write-Host ">>> create annotated tag $tag -> $tip ($r/main)"
      git tag -a $tag $tip -m "Release $tag"
      if ($LASTEXITCODE -ne 0) {
        throw "create tag $tag failed"
      }
    }

    Write-Host ">>> push tag $tag -> $r"
    $remoteTagLine = git ls-remote $r "refs/tags/${tag}" 2>$null
    if ($remoteTagLine) {
      $remoteSha = ($remoteTagLine -split '\s+')[0]
      if ($remoteSha -eq $tip) {
        Write-Host "[skip] $r already has $tag at same commit ($tip)"
        continue
      }
      throw "remote tag $tag on $r points to $remoteSha != $tip. Delete remote tag or use a new version."
    }
    git push $r "refs/tags/${tag}:refs/tags/${tag}"
    if ($LASTEXITCODE -ne 0) {
      throw "push tag to $r failed"
    }
    Write-Host "[ok] $r has $tag"
  }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Done. GitHub Actions: https://github.com/GenkiDoudou/aitodo-desktop/actions'
Write-Host 'After Release assets appear, clients can auto-update via latest.yml / latest-portable.yml.'
Write-Host 'Checklist: desktop/docs/auto-update-manual-checklist.md'

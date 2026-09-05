# 将 desktop/ subtree 同步到开源仓，并在 GitHub 打 v* tag，触发 Actions 打包（供自更新）。
# Gitee 不在此脚本推 tag：subtree 只同步 main；Gitee Release/tag 由 Actions 内脚本创建。
# 目标仓:
#   https://github.com/GenkiDoudou/aitodo-desktop.git
#   https://gitee.com/GenkiDoudou/aitodo-desktop.git
# 默认会自动 commit desktop/ 未提交改动（含版本号 bump）。
#
# 失败重试相关:
#   - Actions Release 工作流失败时会自动删除 GitHub Release+tag，并重置 Gitee 同版本
#   - 本脚本默认等待工作流结束；失败则清远端并重新推 tag（最多 -MaxRetries 次）
#   - -ForceRetag：远端已有同名 tag 时先删再推，强制重跑 Actions
#   - -SkipWait：推完 tag 即退出，不等待 Actions
#
# 示例:
#   .\scripts\release-opensource.ps1
#   .\scripts\release-opensource.ps1 -Version 1.1.0
#   .\scripts\release-opensource.ps1 -NoAutoCommit
#   .\scripts\release-opensource.ps1 -ForceRetag
#   .\scripts\release-opensource.ps1 -SkipWait
[CmdletBinding()]
param(
  [string]$Version = '',
  [switch]$CommitBump,
  [switch]$NoAutoCommit,
  [switch]$Force,
  [switch]$SkipSync,
  [switch]$SkipTag,
  # 远端已有同名 tag 时先删 GitHub Release/tag（及尽力清 Gitee）再推，用于强制重跑
  [switch]$ForceRetag,
  # 推完 tag 后不等待 Actions（默认会等待）
  [switch]$SkipWait,
  # 等待 Actions 成功；失败时自动 ForceRetag 再推，最多重试次数（不含首次）
  [int]$MaxRetries = 1,
  [ValidateSet('both', 'github', 'gitee')]
  [string]$Remote = 'both'
)

$ErrorActionPreference = 'Stop'

$GithubOpenRepo = 'GenkiDoudou/aitodo-desktop'

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

function Test-GhCli {
  try {
    $null = Get-Command gh -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

# 删除 GitHub 上该 tag 的 Release，并顺带删 tag（需已登录 gh）
function Remove-GithubReleaseAndTag {
  param([string]$Tag)
  if (-not (Test-GhCli)) {
    Write-Host ('WARN: gh CLI missing; skip GitHub cleanup. Manual: gh release delete {0} --cleanup-tag --yes' -f $Tag)
    return
  }
  Write-Host ('>>> gh release delete {0} --cleanup-tag' -f $Tag)
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & gh release delete $Tag --repo $GithubOpenRepo --yes --cleanup-tag 2>&1 | ForEach-Object { Write-Host $_ }
  } finally {
    $ErrorActionPreference = $oldEap
  }
  $ErrorActionPreference = 'Continue'
  try {
    & gh api -X DELETE "repos/$GithubOpenRepo/git/refs/tags/$Tag" 2>&1 | Out-Null
  } catch {
    # ignore
  }
  $ErrorActionPreference = $oldEap
}

# 调用 reset 脚本只清 Gitee（不重新上传）；无 GITEE_TOKEN 则跳过
function Remove-GiteeReleaseBestEffort {
  param(
    [string]$DesktopDir,
    [string]$Tag
  )
  if (-not $env:GITEE_TOKEN) {
    Write-Host 'WARN: GITEE_TOKEN not set; skip local Gitee cleanup (Actions failure cleanup still handles it)'
    return
  }
  $script = Join-Path $DesktopDir 'scripts\reset-and-publish-gitee-release.cjs'
  if (-not (Test-Path $script)) {
    Write-Host ('WARN: missing {0}' -f $script)
    return
  }
  Write-Host ('>>> reset Gitee release {0} (SKIP_PUBLISH)' -f $Tag)
  $env:RELEASE_TAG = $Tag
  $env:SKIP_PUBLISH = 'true'
  $env:DRY_RUN = 'false'
  if (-not $env:KEEP_OTHERS) { $env:KEEP_OTHERS = '3' }
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & node $script
  } finally {
    $ErrorActionPreference = $oldEap
  }
}

# 向 GitHub 开源仓推送（或强制重推）发版 tag。
# 返回是否实际执行了 git push tag
function Publish-DesktopGithubTag {
  param(
    [string]$RepoRoot,
    [string]$DesktopDir,
    [string]$Tag,
    [bool]$DoForceRetag
  )

  Push-Location $RepoRoot
  try {
    & (Join-Path $DesktopDir 'scripts\sync-opensource.ps1') -SetupRemotesOnly

    $r = 'desktop-github'
    Write-Host ('>>> fetch {0}' -f $r)
    git fetch $r main --tags
    if ($LASTEXITCODE -ne 0) {
      throw ('fetch {0} failed' -f $r)
    }

    $tip = git rev-parse "$r/main"
    if (-not $tip) {
      throw ('cannot resolve {0}/main' -f $r)
    }

    $existing = git tag -l $Tag
    if ($existing) {
      $tagCommit = git rev-list -n 1 $Tag
      if ($tagCommit -ne $tip) {
        if ($DoForceRetag) {
          Write-Host ('>>> ForceRetag: delete local tag {0} (was {1})' -f $Tag, $tagCommit)
          git tag -d $Tag
          if ($LASTEXITCODE -ne 0) { throw ('delete local tag {0} failed' -f $Tag) }
        } else {
          throw ('local tag {0} exists on other commit ({1} != {2}). Delete local tag or use -ForceRetag.' -f $Tag, $tagCommit, $tip)
        }
      } else {
        Write-Host ('OK: local tag {0} already points at {1}/main' -f $Tag, $r)
      }
    }

    if (-not (git tag -l $Tag)) {
      Write-Host ('>>> create annotated tag {0} -> {1} ({2}/main)' -f $Tag, $tip, $r)
      git tag -a $Tag $tip -m ('Release {0}' -f $Tag)
      if ($LASTEXITCODE -ne 0) {
        throw ('create tag {0} failed' -f $Tag)
      }
    }

    $remoteTagLine = git ls-remote $r "refs/tags/${Tag}" 2>$null
    if ($remoteTagLine) {
      $remoteSha = ($remoteTagLine -split '\s+')[0]
      if ($remoteSha -eq $tip -and -not $DoForceRetag) {
        Write-Host ('OK: {0} already has {1} at same commit ({2}). Use -ForceRetag to delete and re-push.' -f $r, $Tag, $tip)
        return $false
      }
      Write-Host ('>>> cleanup remote {0} then re-push' -f $Tag)
      Remove-GithubReleaseAndTag -Tag $Tag
      Remove-GiteeReleaseBestEffort -DesktopDir $DesktopDir -Tag $Tag
      git push $r ":refs/tags/${Tag}" 2>$null | Out-Null
    }

    Write-Host ('>>> push tag {0} -> {1}' -f $Tag, $r)
    git push $r "refs/tags/${Tag}:refs/tags/${Tag}"
    if ($LASTEXITCODE -ne 0) {
      throw ('push tag to {0} failed' -f $r)
    }
    Write-Host ('OK: {0} has {1}' -f $r, $Tag)
    return $true
  } finally {
    Pop-Location
  }
}

# 等待公开仓 Release 工作流结束。
# 返回: success | failure | cancelled | timed_out | skipped_no_gh
function Wait-ReleaseWorkflow {
  param(
    [string]$Tag,
    [int]$TimeoutMinutes = 120
  )
  if (-not (Test-GhCli)) {
    Write-Host 'WARN: gh CLI missing; skip waiting Actions. Install: https://cli.github.com/'
    return 'skipped_no_gh'
  }

  Write-Host ('>>> waiting GitHub Actions Release (tag={0}, timeout={1}min)...' -f $Tag, $TimeoutMinutes)
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $runId = $null
  $seenPending = $false

  while ((Get-Date) -lt $deadline) {
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $json = & gh run list --repo $GithubOpenRepo --workflow release.yml --limit 15 --json databaseId,status,conclusion,headBranch,event,url,createdAt 2>&1
    $ErrorActionPreference = $oldEap
    if ($LASTEXITCODE -ne 0) {
      Write-Host ('WARN: gh run list failed: {0}' -f $json)
      Start-Sleep -Seconds 15
      continue
    }

    $runs = $json | ConvertFrom-Json
    $candidates = @($runs | Where-Object { $_.headBranch -eq $Tag -or $_.headBranch -eq ('refs/tags/{0}' -f $Tag) })
    if (-not $candidates.Count) {
      if (-not $seenPending) {
        Write-Host '... workflow run not visible yet, keep waiting'
      }
      Start-Sleep -Seconds 15
      continue
    }

    $run = $candidates | Sort-Object { $_.createdAt } -Descending | Select-Object -First 1
    $runId = $run.databaseId
    $status = [string]$run.status
    $conclusion = [string]$run.conclusion
    Write-Host ('... run={0} status={1} conclusion={2} url={3}' -f $runId, $status, $conclusion, $run.url)

    if ($status -eq 'completed') {
      if ($conclusion -eq 'success') { return 'success' }
      if ($conclusion -eq 'cancelled') { return 'cancelled' }
      return 'failure'
    }
    $seenPending = $true
    Start-Sleep -Seconds 20
  }

  Write-Host ('WARN: wait timed out (runId={0})' -f $runId)
  return 'timed_out'
}

$repoRoot = Find-RepoRoot
$desktopDir = Join-Path $repoRoot 'desktop'
$packageJson = Join-Path $desktopDir 'package.json'
$syncScript = Join-Path $desktopDir 'scripts\sync-opensource.ps1'

if (-not (Test-Path $syncScript)) {
  throw ('missing sync script: {0}' -f $syncScript)
}

$current = Get-PackageVersion -PackageJsonPath $packageJson
$target = if ($Version.Trim()) { $Version.Trim().TrimStart('v', 'V') } else { $current }

Write-Host ('repo root: {0}' -f $repoRoot)
Write-Host ('package.json version: {0}' -f $current)
Write-Host ('release version: {0}' -f $target)

if ($target -ne $current) {
  Write-Host ('>>> write package.json version -> {0}' -f $target)
  Set-PackageVersion -PackageJsonPath $packageJson -NewVersion $target
  if ($NoAutoCommit -and -not $CommitBump) {
    throw ('package.json updated to {0} but -NoAutoCommit set. Commit manually or omit -NoAutoCommit.' -f $target)
  }
  Push-Location $repoRoot
  try {
    git add -- desktop/package.json
    git commit -m ('chore(desktop): bump version to {0}' -f $target)
    if ($LASTEXITCODE -ne 0) {
      throw 'auto commit version bump failed'
    }
    Write-Host 'OK: committed desktop/package.json version bump'
  } finally {
    Pop-Location
  }
}

$tag = 'v{0}' -f $target

if (-not $SkipSync) {
  Write-Host ('>>> subtree sync desktop/ (Remote={0})' -f $Remote)
  $syncArgs = @{ Remote = $Remote }
  if ($NoAutoCommit) { $syncArgs.NoAutoCommit = $true }
  if ($Force) { $syncArgs.Force = $true }
  & $syncScript @syncArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'sync-opensource.ps1 failed'
  }
} else {
  Write-Host 'skip: subtree sync'
}

if ($SkipTag) {
  Write-Host 'skip: tagging. Later: .\scripts\release-opensource.ps1 -SkipSync'
  exit 0
}

if ($Remote -eq 'gitee') {
  Write-Host 'skip: Remote=gitee does not push GitHub tag (Gitee Release is created by Actions)'
  Write-Host 'Done.'
  exit 0
}

$attempt = 0
$maxAttempts = 1 + [Math]::Max(0, $MaxRetries)
$useForce = [bool]$ForceRetag

while ($attempt -lt $maxAttempts) {
  $attempt += 1
  Write-Host ''
  Write-Host ('======== release attempt {0} / {1} (ForceRetag={2}) ========' -f $attempt, $maxAttempts, $useForce)

  [void](Publish-DesktopGithubTag -RepoRoot $repoRoot -DesktopDir $desktopDir -Tag $tag -DoForceRetag $useForce)

  if ($SkipWait) {
    Write-Host 'skip: WaitForActions (-SkipWait)'
    break
  }

  $result = Wait-ReleaseWorkflow -Tag $tag
  if ($result -eq 'success') {
    Write-Host ('OK: GitHub Actions Release succeeded ({0})' -f $tag)
    break
  }
  if ($result -eq 'skipped_no_gh') {
    Write-Host 'WARN: cannot wait for Actions; check https://github.com/GenkiDoudou/aitodo-desktop/actions'
    break
  }
  if ($result -eq 'cancelled') {
    throw ('Release workflow cancelled ({0})' -f $tag)
  }

  Write-Host ('FAIL: Release workflow not successful: {0}' -f $result)
  if ($attempt -ge $maxAttempts) {
    throw ('release failed after {0} attempt(s). Later: .\scripts\release-opensource.ps1 -SkipSync -ForceRetag' -f $maxAttempts)
  }

  Write-Host '>>> cleanup remote Release/tag then re-push to re-trigger Actions...'
  Remove-GithubReleaseAndTag -Tag $tag
  Remove-GiteeReleaseBestEffort -DesktopDir $desktopDir -Tag $tag
  Push-Location $repoRoot
  try {
    git push desktop-github ":refs/tags/${tag}" 2>$null | Out-Null
  } finally {
    Pop-Location
  }
  Start-Sleep -Seconds 5
  $useForce = $true
}

Write-Host ''
Write-Host 'Done. GitHub Actions: https://github.com/GenkiDoudou/aitodo-desktop/actions'
Write-Host 'After Release assets appear, clients can auto-update via latest.yml / latest-portable.yml.'
Write-Host 'Checklist: desktop/docs/auto-update-manual-checklist.md'

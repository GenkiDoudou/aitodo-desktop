# 从 Gitee Release 下载小柒todo 免解压包（自动拉取分卷并合并）。
# 双击同目录的「下载免解压版.bat」即可；也可在 PowerShell 中直接运行本脚本。
#
# 可选参数：
#   -Owner GenkiDoudou
#   -Repo aitodo-desktop
#   -Tag v1.0.0          # 不填则用 latest
#   -OutDir .\           # 输出目录

param(
  [string]$Owner = "GenkiDoudou",
  [string]$Repo = "aitodo-desktop",
  [string]$Tag = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $OutDir) {
  $OutDir = (Get-Location).Path
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$work = Join-Path $OutDir "_aitodo_portable_download"
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Force -Path $work | Out-Null

function Get-Sha512Base64([string]$FilePath) {
  $sha = [System.Security.Cryptography.SHA512]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($FilePath)
    try {
      $hash = $sha.ComputeHash($stream)
      return [Convert]::ToBase64String($hash)
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha.Dispose()
  }
}

function Download-File([string]$Url, [string]$Dest) {
  Write-Host "  下载 $([IO.Path]::GetFileName($Dest)) ..."
  Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

Write-Host "查询 Gitee Release: $Owner/$Repo ..."
if ($Tag) {
  $api = "https://gitee.com/api/v5/repos/$Owner/$Repo/releases/tags/$([uri]::EscapeDataString($Tag))"
} else {
  $api = "https://gitee.com/api/v5/repos/$Owner/$Repo/releases/latest"
}
$release = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "aitodo-portable-downloader" }
$assets = @($release.assets)
if (-not $assets -or $assets.Count -eq 0) {
  throw "该 Release 没有附件"
}

$ymlAsset = $assets | Where-Object { $_.name -eq "latest-portable.yml" } | Select-Object -First 1
if (-not $ymlAsset) {
  throw "Release 中缺少 latest-portable.yml"
}

$ymlPath = Join-Path $work "latest-portable.yml"
Download-File $ymlAsset.browser_download_url $ymlPath
$ymlText = Get-Content -Raw -Encoding UTF8 $ymlPath

function Get-YmlField([string]$text, [string]$key) {
  $m = [regex]::Match($text, "(?m)^${key}:\s*(.+?)\s*$")
  if (-not $m.Success) { return $null }
  return $m.Groups[1].Value.Trim()
}

$zipName = Get-YmlField $ymlText "path"
$expectSha = Get-YmlField $ymlText "sha512"
$version = Get-YmlField $ymlText "version"
if (-not $zipName -or -not $expectSha) {
  throw "latest-portable.yml 缺少 path / sha512"
}

$partNames = [regex]::Matches($ymlText, "(?m)^part:\s*(.+?)\s*$") | ForEach-Object { $_.Groups[1].Value.Trim() }
$zipOut = Join-Path $OutDir $zipName

Write-Host "版本: $version"
Write-Host "目标: $zipOut"

function Find-AssetUrl([string]$name) {
  $a = $assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if ($a) { return $a.browser_download_url }
  return $null
}

$fullUrl = Find-AssetUrl $zipName
if ($fullUrl) {
  Write-Host "发现完整 zip，直接下载..."
  Download-File $fullUrl $zipOut
} elseif ($partNames.Count -gt 0) {
  Write-Host "完整 zip 超过 Gitee 限制，改为下载 $($partNames.Count) 个分卷并合并..."
  $partFiles = @()
  foreach ($name in $partNames) {
    $url = Find-AssetUrl $name
    if (-not $url) { throw "Release 缺少分卷: $name" }
    $partPath = Join-Path $work $name
    Download-File $url $partPath
    $partFiles += $partPath
  }
  Write-Host "合并分卷 -> $zipName ..."
  $outStream = [System.IO.File]::Create($zipOut)
  try {
    foreach ($pf in $partFiles) {
      $bytes = [System.IO.File]::ReadAllBytes($pf)
      $outStream.Write($bytes, 0, $bytes.Length)
    }
  } finally {
    $outStream.Dispose()
  }
} else {
  throw "既没有完整 zip，也没有 part: 分卷列表"
}

Write-Host "校验 sha512 ..."
$actual = Get-Sha512Base64 $zipOut
if ($actual -ne $expectSha) {
  Remove-Item -Force $zipOut -ErrorAction SilentlyContinue
  throw "校验失败：sha512 不匹配，已删除不完整文件"
}

Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "完成: $zipOut"
Write-Host "请解压后运行其中的 小柒todo.exe（数据默认在 exe 同级 data/ 目录）。"
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

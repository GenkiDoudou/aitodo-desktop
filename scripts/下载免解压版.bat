@echo off
chcp 65001 >nul
title 下载小柒todo免解压版（Gitee分卷合并）
echo 将从 Gitee 下载免解压包（若有分卷会自动合并）...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0download-portable-from-gitee.ps1" -OutDir "%~dp0"
if errorlevel 1 (
  echo.
  echo 下载失败。也可在 Release 页面手动下载全部 .part* 后联系维护者。
  pause
  exit /b 1
)

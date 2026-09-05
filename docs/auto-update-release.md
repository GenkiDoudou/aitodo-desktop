# 桌面端发版与自动更新上传说明

## 开源公开仓（仅含 desktop/）

| 平台 | 用途 |
|------|------|
| GitHub | **源码 subtree、发版资产、客户端自动更新**：[GenkiDoudou/aitodo-desktop](https://github.com/GenkiDoudou/aitodo-desktop) |

私有 monorepo（`ai-todo`）通过 **git subtree** 只把 `desktop/` 同步到公开仓，见 [`opensource-subtree.md`](opensource-subtree.md)。

客户端更新源配置见 `electron/main/update/update-feed-config.ts`（仅 GitHub）。

## 产物（`desktop/dist/`）

| 文件 | 用途 |
|------|------|
| `小柒todo Setup x.y.z.exe` + `.blockmap` | Windows NSIS 安装版 + 差分 |
| `latest.yml` | NSIS 自动更新清单 |
| `*-win.zip` | 免解压全量包 |
| `*.part01`… | 可选分卷（历史兼容；GitHub 以完整 zip 为主） |
| `latest-portable.yml` | 免解压清单 |
| Mac zip + `latest-mac.yml` | macOS 自动更新 |

**注意**：zip 内不得包含用户 `data/`。

## 发版上传

同一 git tag / 版本号，资产上传到 **GitHub Releases**（`release.yml`），文件名与清单一致。

- 打 `v*` tag → Actions 打包 → `softprops/action-gh-release` 上传
- 失败时自动删除本次 GitHub Release + tag，便于重新推同名 tag

本机发版：

```powershell
cd desktop
pnpm run release:opensource
# 默认等待 Actions；同版本重复执行会自动删旧 tag/Release 再推
```

需本机对 GitHub 公开仓有 push 权限；等待 Actions 需安装并登录 [GitHub CLI](https://cli.github.com/)。

## 建议步骤

```powershell
cd desktop
# 1. desktop/ 已 commit
# 2. 发版（subtree 推送 + 打 tag 触发 Actions）
.\scripts\release-opensource.ps1 -Version 1.1.0
# 或版本已写好：
pnpm run release:opensource
```

完成后用旧版测检查更新（[`auto-update-manual-checklist.md`](auto-update-manual-checklist.md)）。

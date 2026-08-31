# 桌面端发版与自动更新上传说明

## 开源公开仓（仅含 desktop/）

| 平台 | 仓库 |
|------|------|
| Gitee（客户端优先） | https://gitee.com/GenkiDoudou/aitodo-desktop |
| GitHub（回退） | https://github.com/GenkiDoudou/aitodo-desktop |

私有 monorepo（`ai-todo`）通过 **git subtree** 只把 `desktop/` 同步到上述公开仓，见 [`opensource-subtree.md`](opensource-subtree.md)。

客户端内置更新源默认即为 `GenkiDoudou/aitodo-desktop`（见 `electron/main/update/update-feed-config.ts`）。

## 产物（`desktop/dist/`）

| 文件 | 用途 |
|------|------|
| `小柒todo Setup x.y.z.exe` + `.blockmap` | Windows NSIS 安装版 + 差分 |
| `latest.yml` | NSIS 自动更新清单 |
| `*-win.zip` | 免解压全量包（GitHub 完整上传） |
| `*.part01`… | Gitee 分卷（zip≥90MB 时） |
| `下载免解压版.bat` + `download-portable-from-gitee.ps1` | Gitee 手动获取免解压包 |
| `latest-portable.yml` | 免解压清单 |
| Mac zip + `latest-mac.yml` | macOS 自动更新 |

**注意**：zip 内不得包含用户 `data/`。

## 双仓上传

同一 git tag / 版本号，将资产上传到 Gitee + GitHub Releases，**文件名必须一致**。

- **GitHub**：完整 zip + yml / Setup + 下载脚本
- **Gitee**：单附件 **&lt;100MB**；大 zip 切分卷

需在 GitHub 仓库配置 `GITEE_TOKEN`。

## 建议步骤

```powershell
cd desktop
# 1. desktop/ 已 commit
# 2. 发版（subtree 推送 + 打 tag 触发 Actions）
.\scripts\release-opensource.ps1 -Version 1.1.0 -CommitBump
# 或版本已写好：
pnpm run release:opensource
```

完成后用旧版测检查更新（[`auto-update-manual-checklist.md`](auto-update-manual-checklist.md)）。

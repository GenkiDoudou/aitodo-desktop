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
- **Gitee**：单附件 **&lt;100MB**；大 zip 切分卷；**全仓库附件总量约 1GB**，超出后新附件一律 HTTP 400（`文件大小已超出仓库附件配额：1 GB`）

### Gitee 1GB 配额满了怎么办

**常见原因**：仓库附件配额是**全仓合计约 1GB**（所有历史 Release 的 Setup / `.part*` 等）。  
自动修剪只删「保留窗口之外」的版本；若窗口过大（例如 KEEP=8）而实际只有 6～8 个版本，会**删 0 个附件**，配额仍满，新上传 Setup 就会 `HTTP 400 超出仓库附件配额：1 GB`。

1. **用 GitHub Actions 补发（推荐，不用本机配 TOKEN）**  
   公开仓 → Actions → **Reset and Publish Gitee** → Run workflow：填入 `tag`（如 `v1.0.9`）。  
   会从该 tag 的 **GitHub Release** 下载产物 → 重置 Gitee 同名 Release/附件 → 再上传。  
   （需先 `subtree` 把本仓库的 workflow 同步到公开仓。）
正式发版打 `v*` tag 触发 **Release** 工作流。  
失败时工作流会**自动清理** GitHub Release+tag 与 Gitee 同版本；本机 `release-opensource.ps1` 默认等待 Actions，失败则重推 tag（可用 `-SkipWait` / `-ForceRetag`）。
3. **只修剪旧附件**：Actions → **Cleanup Gitee Attachments**（先 dry-run，再实删；`keep` 建议 3）。
4. **本机**（可选，需自行设 `GITEE_TOKEN` / `RELEASE_TAG`）：
   ```powershell
   cd desktop
   $env:GITEE_TOKEN = "你的令牌"
   $env:RELEASE_TAG = "v1.0.9"
   pnpm run reset:publish:gitee
   ```
5. 上传支持 **同名附件跳过** + **网络瞬断重试**；分卷仍失败时 GitHub Release 仍有完整 zip。

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

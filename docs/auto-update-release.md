# 桌面端发版与自动更新上传说明

## 开源公开仓

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
| `latest.yml` | NSIS 自动更新清单（electron-builder 生成） |
| `*-win.zip`（或 builder 生成的 Windows zip） | 免解压目录全量包（GitHub 完整上传） |
| `*.part01`… | Gitee 分卷（zip≥90MB 时） |
| `下载免解压版.bat` + `download-portable-from-gitee.ps1` | **Gitee 手动获取免解压包**：自动下分卷、合并、校验 |
| `latest-portable.yml` | 免解压清单（含可选 `part:` 列表） |
| Mac zip + `latest-mac.yml` | macOS 自动更新（`build:mac`） |
| Mac dmg（可选） | 仅手动安装，不参与自动更新主路径 |

**注意**：zip 内不得包含用户 `data/` 目录（打包自 `win-unpacked` 程序文件即可）。

## 双仓上传

同一 git tag / 版本号，将上表资产上传到 Gitee + GitHub Releases，**文件名必须一致**（分卷名也要一致）。

- **GitHub**：完整 `*-win.zip` + 可选 `.part*` + yml / Setup + 下载脚本
- **Gitee**：单附件 **&lt;100MB**。大 zip 切分卷；用户首次要免解压包时，下载并运行 **`下载免解压版.bat`**（会从 Gitee 拉分卷合并，不走 GitHub）。应用内自动更新同样走 Gitee 分卷逻辑。

需在 GitHub 仓库配置 `GITEE_TOKEN`（Gitee 私人令牌，projects 权限）。

## 无代码签名

首版不签名。Windows 可能出现 SmartScreen，macOS 可能出现 Gatekeeper 提示；用户需手动允许。完整性依赖清单中的 `sha512`。

## 建议步骤

1. 在私有仓 bump `desktop/package.json` 的 `version` 并提交
2. 运行 subtree 同步脚本，把 `desktop/` 推到两个公开仓
3. 确认 GitHub 公开仓已配置 `GITEE_TOKEN` Secret
4. 在公开仓打 tag（如 `v1.1.0`）并 `git push desktop-github v1.1.0`（可同时 `git push desktop-gitee v1.1.0`）
5. 等待 Actions：GitHub Release + Gitee Release 均应出现产物
6. 用旧版 NSIS / 免解压 / Mac 各测一遍检查更新

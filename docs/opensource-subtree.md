# 用 git subtree 同步开源桌面仓

私有 monorepo `ai-todo` 保持完整工程；**仅将 `desktop/`** 推送到：

- https://github.com/GenkiDoudou/aitodo-desktop.git
- https://gitee.com/GenkiDoudou/aitodo-desktop.git

脚本位于 `desktop/scripts/`（可从 `desktop/` 目录执行）。

## 一次性：添加 remote

```powershell
cd desktop
pnpm run sync:opensource -- -SetupRemotesOnly
# 或
.\scripts\sync-opensource.ps1 -SetupRemotesOnly
```

等价手动（在 monorepo 根）：

```powershell
git remote add desktop-github git@github.com:GenkiDoudou/aitodo-desktop.git
git remote add desktop-gitee git@gitee.com:GenkiDoudou/aitodo-desktop.git
```

> 使用 **SSH**（本机已配置密钥）。若仍用 HTTPS，GitHub 不再接受密码，需 Personal Access Token。

## 日常同步（只推已提交的 desktop/）

**重要**：subtree 只推送已 commit 的 `desktop/`。脚本**默认会自动** `git add desktop/` 并 commit（信息：`chore(desktop): auto-commit before opensource sync`）。若不想自动提交，加 `-NoAutoCommit`。

```powershell
cd desktop
pnpm run sync:opensource
```

等价：

```powershell
# monorepo 根
git subtree push --prefix=desktop desktop-github main
git subtree push --prefix=desktop desktop-gitee main
```

公开仓默认分支应为 `main`。

若出现 `non-fast-forward`，说明公开仓 `main` 与本地 subtree 历史不一致（例如在 GitHub/Gitee 上直接改过）。脚本会**自动 force push**，以私有仓 `desktop/` 为准覆盖远程。也可显式加 `-Force`。

## 发版（自动打包 + 自更新）

公开仓 `.github/workflows/release.yml`：推送 `v*` tag 后自动 `build:win` 并上传 GitHub / Gitee Releases。

```powershell
cd desktop
pnpm run release:opensource

# 升版本并自动 commit package.json
.\scripts\release-opensource.ps1 -Version 1.1.0 -CommitBump
```

前置：`desktop/` 已提交；GitHub 公开仓配置 Secret `GITEE_TOKEN`；本机对两公开仓有 push 权限。

详见 [auto-update-release.md](auto-update-release.md)。

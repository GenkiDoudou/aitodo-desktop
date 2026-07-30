# 用 git subtree 同步开源桌面仓

私有仓 `ai-todo` 保持不开源；仅将 `desktop/` 推送到：

- https://github.com/GenkiDoudou/aitodo-desktop.git
- https://gitee.com/GenkiDoudou/aitodo-desktop.git

## 一次性：添加 remote

在 **monorepo 根目录**执行：

```powershell
git remote add desktop-github https://github.com/GenkiDoudou/aitodo-desktop.git
git remote add desktop-gitee https://gitee.com/GenkiDoudou/aitodo-desktop.git
```

若已存在可跳过。也可用仓库内脚本：

```powershell
# 在 monorepo 根目录
.\scripts\sync-desktop-opensource.ps1 -SetupRemotesOnly
```

## 日常同步（把已提交的 desktop 推出去）

**重要**：subtree 只包含 **已 commit** 到当前分支的 `desktop/` 内容；未提交改动不会出现在公开仓。

```powershell
# 在 monorepo 根目录
.\scripts\sync-desktop-opensource.ps1
```

等价手动命令：

```powershell
git subtree push --prefix=desktop desktop-github main
git subtree push --prefix=desktop desktop-gitee main
```

首次推到空仓库时，公开仓默认分支应为 `main`。

## 注意

- 不要在公开仓直接大改后再期望自动合回私有仓（subtree 反向合并可行但易乱）；以私有仓为源、单向推送最简单
- 公开仓 README 中勿引用私有 `todo-service` 源码路径；同步服务写成「可选自建」即可
- Release 资产上传见 [auto-update-release.md](auto-update-release.md)

# LiteLLM 项目记忆

## 仓库结构（2026-09-17 起）
- **二开主战场：`D:\project\litellm-cn`**（独立副本，日常开发只在这里）
  - `upstream` = https://github.com/BerriAI/litellm.git（push 指向 DISABLED_NO_PUSH，物理禁止误推）
  - `backup` = D:/project/litellm-fork.git（本地裸仓库）
  - `origin` = 用户 GitHub 私有仓库（待接入）
- 旧副本 `D:\project\litellm`：origin=本地裸仓库，upstream=BerriAI，保留作同步参考
- 分支铁律：main 只跟上游（ff-only），自有改动全部走 develop + feat 分支
- 二次开发方案：根 `FORK-AND-LOCALIZATION-PLAN.md`（总览）+ `dev-plans/`（11 份需求文档，冲突时以此为准）
- 本机 git user.name/user.email 为空，commit 前需设置

## 环境怪癖（重要，遇错先想起这里）
- 本机 bash 沙箱会静默丢弃 `.git/refs/remotes/` 下的引用文件写入（reflog/objects/config 正常）：`git fetch`、`git branch --set-upstream-to` 会"假成功"。变通：远程跟踪引用相关操作用 PowerShell 直接执行/写文件；push、commit、本地分支创建不受影响
- PowerShell 工具不回显命令输出：需 `| Out-File` 写文件再 Read
- bash 缺 coreutils（无 ls/cat/head/grep），只有 git 可用
- 沙箱黑名单含 `wsl.exe`（PROGRAM BLOCKED BY SECURITY POLICY，不可绕过）→ WSL 相关状态/操作只能让用户自己在终端执行
- 本机装的 Anaconda 是 2018 年的 **Anaconda3 5.3.1 / Python 3.7.0**（`C:\ProgramData\anaconda3`），conda 4.5.11（**无 `conda init`、无 `conda run`**）。base 不可用，但已据此新建环境 **`litellm-cn` = Python 3.13.15**，配上 uv 做日常开发环境（conda 给解释器、uv 按 uv.lock 装依赖）
- **conda 会把"有新版本"提示写 stderr → PowerShell 判为 NativeCommandError 而报失败**：退出码不可信，要看日志里有无 `Executing transaction: done`
- **uv 在本自动化沙箱内跑不通**：它用 `\\?\` 前缀 verbatim 路径做原子写入，被沙箱路径过滤拦成 `os error 5`（同目录用 Set-Content 写入正常，证明不是权限问题）。**`uv sync` 必须让用户在自己终端执行**
- **PyPI 官方 CDN 在国内超时**：uv/pip 需配 `UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple`
- Docker 未安装，WSL / VirtualMachinePlatform 已于 2026-09-17 启用（**待重启生效**）→ 之后 `winget install -e --id Docker.DockerDesktop`，再 `docker compose up db -d`（只起 db 服务）

## 项目约定
- 上游 CLAUDE.md 代码规范生效：无 AI 风格注释、Python 行宽 120、禁 `# type: ignore`、Prisma 迁移只改 schema 不重写行、commit 用 conventional commits、不加 Claude 署名

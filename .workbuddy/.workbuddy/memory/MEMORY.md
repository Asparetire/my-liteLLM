# LiteLLM 项目记忆

## 仓库结构（2026-09-17 起）
- `upstream` = https://github.com/BerriAI/litellm.git（只读同步源）
- `origin` = D:/project/litellm-fork.git（用户自有本地裸仓库）
- 分支铁律：main 只跟上游（ff-only），自有改动全部走 develop + feat 分支
- 二次开发方案文档：仓库根 `FORK-AND-LOCALIZATION-PLAN.md`

## 环境怪癖（重要，遇错先想起这里）
- 本机 bash 沙箱会静默丢弃 `.git/refs/remotes/` 下的引用文件写入（reflog/objects/config 正常）：`git fetch`、`git branch --set-upstream-to` 会"假成功"。变通：远程跟踪引用相关操作用 PowerShell 直接执行/写文件；push、commit、本地分支创建不受影响
- PowerShell 工具不回显命令输出：需 `| Out-File` 写文件再 Read
- bash 缺 coreutils（无 ls/cat/head/grep），只有 git 可用

## 项目约定
- 上游 CLAUDE.md 代码规范生效：无 AI 风格注释、Python 行宽 120、禁 `# type: ignore`、Prisma 迁移只改 schema 不重写行、commit 用 conventional commits、不加 Claude 署名

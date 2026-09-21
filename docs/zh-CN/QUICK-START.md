# 二次开发快速开始

## 🎯 目标

基于 fork 仓库完成前端全面汉化与 token 计费改造，并补充安全、国内化等工程化能力。

## 📦 环境准备（已完成）

- ✅ Git 仓库已 fork：`D:/project/litellm-fork.git`
- ✅ 分支结构创建：`main`, `develop`, `feat/*`
- ✅ Git hooks 目录：`.git-hooks/`
- ✅ 需求文档在 `dev-plans/`

## 🚀 快速使用

### 1. 查看当前状态

```bash
# 查看分支
git br -v

# 查看未暂存的更改
git st

# 查看所有文件
git status --short
```

### 2. 开始开发新功能

**步骤 1：从 develop 切分支**

```bash
git checkout develop        # 切换到开发基线
git pull origin develop     # 拉取最新代码
git checkout -b feat/xxx    # 创建功能分支
```

**步骤 2：开发并测试**

- UI 汉化：`npm run test:component`
- 后端改动：`make test-unit`
- 检查 Lint：`make check`

**步骤 3：提交推送**

```bash
git add .
git commit -m "feat: ..."
git push origin feat/xxx
```

### 3. 开发完成后合并

```bash
git checkout develop        # 回到开发分支
git merge feat/xxx          # 合入功能
git push origin develop     # 推送并清理
git push origin --delete feat/xxx
```

## 📁 文件位置速查

| 目录 | 用途 |
|------|------|
| `dev-plans/` | 需求拆解文档（P0/P1/P2） |
| `docs/zh-CN/` | 中文文档（独立演进） |
| `.git-hooks/` | Git hooks 脚本 |
| `ui/litellm-dashboard/` | 前端 UI（Next.js） |
| `litellm/proxy/` | 后端代理（FastAPI） |

## 🔑 重要规则

### 不可触碰清单

- ❌ API 字段名：`max_budget`, `tpm_limit`, `spend`...
- ❌ 数据库列名：Prisma schema 中的所有字段
- ❌ 代码标识符：类名、函数名、变量名（保持英文）
- ❌ 日志级别：DEBUG, INFO, WARN, ERROR

### Prisma 迁移红线

- ✅ 只允许加 nullable 列（`BigInt?`, `Float?`）
- ❌ 禁止 UPDATE/DELETE/MERGE（启动时同步执行会锁表）

## 🧪 测试命令

```bash
# 后端单元测试
make test-unit

# UI 组件测试
npm run test:component

# 集成测试
make test-integration

# 运行单测文件
uv run --no-sync pytest -xvs tests/path/to/test.py
```

## 📚 详细文档

- [开发管理规范](../../dev-plans/GIT-开发管理规范.md) - Git 操作规范
- [分支管理回滚指南](.git-hooks/branch-manage.md) - 回滚操作
- [总览方案](../../dev-plans/00-总体方案.md) - 完整需求

## 📞 需要帮助？

1. 查看 `dev-plans/README.md` 了解需求优先级
2. 查阅上游仓库文档：[GitHub CLAUDE.md](https://github.com/BerriAI/litellm/blob/main/CLAUDE.md)
3. 参考本次创建的各目录中的指南

---

**当前分支**: `develop`  
**基线版本**: v1.102.0  
**创建时间**: 2026-09-17

# 本地 Git 管理方案总结

## ✅ 已完成配置

### 1. 分支结构

```
main              <- 上游镜像（只读，fast-forward only）
develop           <- 开发基线（所有功能集成点）
feat/i18n-ui-frontend      [UI 汉化前端]
feat/token-billing-phase-a [计费阶段 A：配置层 Token 换算]
feat/error-i18n-backend    [后端错误信息汉化]
feat/doc-i18n-users       [用户文档汉化]
```

### 2. Git 别名

| 别名 | 命令 |
|------|------|
| `git st` | `git status` |
| `git co <分支>` | `git checkout <分支>` |
| `git br <新分支>` | `git branch <新分支>` |
| `git last` | `git log -1` |
| `git logit` | `git log --stat` |

### 3. Hooks 目录

- `.git-hooks/pre-commit/i18n-check.txt` - i18n 检查钩子
- `.git-hooks/branch-manage.md` - 分支管理指南
- `.git-hooks/pre-commit/README.md` - hooks 使用说明

### 4. 文档体系

- `docs/zh-CN/GIT-开发管理规范.md` - 完整管理规范
- `dev-plans/` - 需求拆解文档
- `FORK-AND-LOCALIZATION-PLAN.md` - 总体方案

## 📋 使用方法

### 开始开发新功能

```bash
# 1. 从 develop 切分支
git checkout develop
git pull origin develop
git checkout -b feat/<新需求>

# 2. 开发并测试
make test-unit
npm run test:component

# 3. 提交推送
git add .
git commit -m "feat: ..."
git push origin feat/<分支名>
```

### 完成后合回 develop

```bash
git checkout develop
git merge feat/<分支名>
git push origin develop --delete feat/<分支名>
```

## 🔄 回滚指南

### 快速回滚到上一个稳定提交

```bash
# 查看最近提交
git log -n 10 --oneline

# 假设要回退到第 N 个提交，重置
git reset --hard HEAD~N
git push origin <分支名> --force-with-lease
```

### 删除已清理的分支

```bash
# 本地删除
git branch -d feat/<分支名>

# 远程删除
git push origin --delete feat/<分支名>
```

## ⚠️ 重要提醒

1. **main 分支永不改动**：只接收 upstream/fast-forward merge
2. **不可触碰清单**：API 字段、数据库列、代码标识符保持英文
3. **Prisma 迁移红线**：只加 nullable 列，禁止 UPDATE/DELETE/MERGE
4. **推送前检查**：运行 `make check` 确保 lint + 测试通过

## 📚 相关文档

- [开发管理规范](docs/zh-CN/GIT-开发管理规范.md)
- [分支管理回滚指南](.git-hooks/branch-manage.md)
- [总览方案](FORK-AND-LOCALIZATION-PLAN.md)
- [需求拆解](dev-plans/README.md)

## 🛠️ 快速命令速查

```bash
# 查看分支状态
git st

# 切换分支
git co <分支>

# 创建新分支
git br feat/xxx

# 查看提交历史
git logit --oneline -20

# 拉取上游更新
git checkout main && git fetch upstream && git merge --ff-only upstream/main

# 推送当前分支
git push origin <分支名>
```

## ✨ 下一步

根据 `dev-plans/` 目录中的需求文档开始开发：

1. **P0（第 1 周）**：计费阶段 A、B + UI i18n 基建
2. **P1（第 2-4 周）**：汉化主体 + 国内提供商接入
3. **P2（第 5-8 周）**：原生 token 配额 + 深度改造

---

创建时间：2026-09-17  
基线版本：v1.102.0 (commit `8481bc27f9`)  
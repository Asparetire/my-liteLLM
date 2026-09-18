# 本地 Git 开发管理方案

## 目录结构

```
litellm-cn/
├── .git-hooks/              # Git 钩子（pre-commit, pre-push）
│   ├── pre-commit/
│   │   └── i18n-check.txt   # i18n 检查钩子
├── docs/zh-CN/              # 中文文档
│   ├── README.md
│   └── <翻译文件>
├── dev-plans/               # 开发需求拆解
├── FORK-AND-LOCALIZATION-PLAN.md  # 总览方案
└── [功能分支代码]           # 各种 feat/* 分支的开发代码
```

## 分支模型（铁律）

| 分支名 | 用途 | 可推送？ | 可合并？ |
|--------|------|---------|---------|
| `main` | 上游镜像，**永不携带自有改动** | ❌ | ✅ 只接收 upstream 的 fast-forward |
| `develop` | 自有改动的集成基线 | ✅ 本地分支合入 | ✅ 功能分支合回此处 |
| `feat/*` | 功能开发分支 | ✅ | ✅ 完成后合到 develop |
| `docs/zh-CN/*` | 文档翻译 | ✅ | ✅ |

## 日常操作流程

### 1. 更新上游代码

```bash
# 在 main 分支上执行
git checkout main
git fetch upstream
git merge --ff-only upstream/main || echo "上游有冲突，需要手动解决"
git push origin main
```

### 2. 从 develop 切功能分支

```bash
# 先同步最新开发基线
git checkout develop
git pull origin develop

# 创建功能分支（命名规范：feat/<需求编号>-<简短描述>）
git checkout -b feat/i18n-ui-frontend

# 开发完成后合回 develop
git add .
git commit -m "feat: UI 汉化第 1 批完成"
git push origin feat/i18n-ui-frontend

# 合到 develop
git checkout develop
git merge feat/i18n-ui-frontend
git push origin develop --delete feat/i18n-ui-frontend  # 清理本地分支
```

### 3. Git 别名（方便操作）

```bash
git st     # status
git co <分支>  # checkout
git br <新分支>  # branch
git last    # log -1
git logit   # log --stat
```

查看已配置的别名：`git config --list | grep alias`

### 4. 本地开发规范

#### 不可触碰清单

以下项必须保持英文，不可翻译或修改：

- **API 字段名**：`max_budget`、`tpm_limit`、`spend`、`token_spend` 等
- **数据库列名**：所有 Prisma schema 中的字段
- **代码标识符**：类名、函数名、变量名
- **日志级别**：DEBUG、INFO、WARN、ERROR
- **异常类型名**：各类 Exception/Error 类名

违反这些规定的地方需要标记为 `[CN-FORK]`：

```python
# === [CN-FORK] BEGIN: 将错误信息翻译为中文 ===
raise litellm.exceptions.LiteLLMException(
    message="Token 配额已用完",  # ✅ 可以翻译，这是面向用户的信息
    status_code=429
)
# === [CN-FORK] END ===
```

#### Prisma 迁移红线

- **只允许加 nullable 列**（`max_token_budget BigInt?`, `token_spend BigInt @default(0)`）
- **禁止 UPDATE/DELETE/MERGE**：启动时同步执行迁移，任何重写行都会锁表
- 新字段初始值为 `null` 或 `@default(0)`，保持向后兼容

#### 注释规范

- 遵循仓库 CLAUDE.md：**无 AI 风格注释**
- Python 行宽 120 字符（Google 风格指南）
- 禁用 `# type: ignore`：使用 pyright 抑制语法 `# pyright: ignore[xxx]`

## 钩子配置

### Pre-commit 钩子

位于 `.git-hooks/pre-commit/`，包含：

```bash
i18n-check.txt      # 检查 UI 汉化是否遗漏美元符号
# TODO: 添加更多检查规则
```

运行方式：每次 `git commit` 前自动执行

### 使用方法

```bash
# 查看钩子内容
cat .git-hooks/pre-commit/i18n-check.txt

# 临时禁用某个钩子（不推荐）
git config core.hooksPath /dev/null

# 重新启用
git config core.hooksPath .git-hooks
```

## 分支管理策略

### 功能分支命名

遵循 conventional commits：

- `feat/ui-haniz` - UI 汉化新功能
- `feat/token-billing-a` - 计费阶段 A（配置层换算）
- `fix/xxx` - 修复 bug
- `docs/zh-CN/deploy.md` - 中文文档新增
- `chore/update-deps` - 依赖更新

### 同步频率

| 分支状态 | 同步频率 | 操作 |
|----------|---------|------|
| 刚 fork 或大冲突时 | 每天 1 次 | `git merge upstream/main` |
| 小功能开发期 | 每周 1 次 | M0/M1 里程碑节点 |
| 接近 main 合并 | 每次同步演练 | 见第 6 节 |

### 冲突解决流程

```bash
# 1. 在 develop 上发现冲突
git checkout develop
git pull origin develop

# 2. 更新 upstream
git fetch upstream
git merge upstream/main

# 3. 冲突只允许在这一步出现并集中处理
#    使用 git mergetool 或手动解决
git add <冲突文件>  # 标记为已解决
git commit

# 4. 推送到 origin
git push origin develop
```

## 回滚方案

### 场景一：功能分支需要撤销

```bash
# 查看分支历史
git log --oneline --graph --all | grep feat/ui-haniz

# 重置到特定提交（保留提交历史）
git reset --soft HEAD~1

# 或直接删除分支重新开始
git branch -d feat/ui-haniz
git checkout -b feat/ui-haniz-new
```

### 场景二：develop 基线需要回退

```bash
# 查看最近 N 次提交
git log -n 5 --oneline

# 找到问题提交的哈希值 XXX，重置到上一个稳定点
git reset --hard XXX

# 强制推送（仅当你确定分支是孤立的）
git push origin develop --force
```

### 场景三：main 需要保持纯上游

```bash
# main 永远只能 fast-forward
git checkout main
git pull upstream main
# 如果上游有合并或分支变，拒绝自动合并
git merge --ff-only upstream/main || echo "只允许 forward merge"
```

## 检查清单

### Commit 前

- [ ] 运行 `make check`（linting）
- [ ] UI 汉化后跑 `npm run test:component`
- [ ] 后端改动后跑 `make test-unit`
- [ ] 检查是否有美元符号泄露（UI 文件）
- [ ] Prisma 迁移只加 nullable 列

### Push 前

- [ ] `git push origin <分支>` 成功
- [ ] 无未暂存的更改
- [ ] 钩子都通过了

### Merge 到 main 前

- [ ] 完成全局验收标准（见总览方案第 7 节）
- [ ] API 响应只增字段不改字段
- [ ] 所有测试通过
- [ ] 与 `upstream/main` fast-forward merge 成功

## 常用命令速查

```bash
# 查看分支
git br -v

# 切换分支
git co <分支名>

# 创建并切换到新分支
git checkout -b <新分支>

# 查看差异
git diff main              # 与 main 的差异
git diff develop           # 与 develop 的差异

# 添加并提交
git add <文件>
git commit -m "feat: ..."

# 查看提交历史（带统计）
git logit --oneline -20

# 查看最近改动
git st

# 拉取上游
git fetch upstream
git merge upstream/main

# 推送当前分支
git push origin <分支名>
```

## 注意事项

1. **不要直接推 main**：main 应该只反映上游状态
2. **功能分支及时清理**：完成后合到 develop 并删除本地分支
3. **文档翻译独立演进**：docs/zh-CN/ 待合并时批量处理
4. **Prisma 迁移先演练**：在测试库运行 `prisma migrate dev`

## 联系与支持

如有问题，查阅以下文件：

- [`dev-plans/README.md`](../dev-plans/README.md) - 需求总览
- [`FORK-AND-LOCALIZATION-PLAN.md`](../FORK-AND-LOCALIZATION-PLAN.md) - 总体方案
- 上游仓库 [`CLAUDE.md`](https://github.com/BerriAI/litellm/blob/main/CLAUDE.md)

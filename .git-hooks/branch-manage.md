# 本地分支管理与回滚指南

## 当前分支结构

```
main              <- 上游镜像，只接收 upstream/main (fast-forward)
  ↑
  | fast-forward merge only
develop           <- 开发基线，功能分支合到这里后删除
  ↑
feat/i18n-ui-frontend   [UI 汉化]
feat/token-billing-phase-a  [计费阶段 A]
feat/error-i18n-backend    [后端错误汉化]
feat/doc-i18n-users       [文档汉化]
```

## 分支操作流程

### 开发新需求

```bash
# 1. 从 develop 切新功能分支
git checkout develop
git pull origin develop
git checkout -b feat/<需求编号>-<简短描述>

# 2. 开发完成后测试
make test-unit              # 后端测试
npm run test:component      # UI 组件测试

# 3. 提交并推送
git add .
git commit -m "feat: <描述>"
git push origin feat/<分支名>
```

### 合回 develop

```bash
git checkout develop
git merge feat/<分支名>
git push origin develop --delete feat/<分支名>
```

### 查看分支关系

```bash
# 可视化分支图
git log --oneline --graph --all | grep -E "^[*+-]"

# 查看特定分支提交
git log feat/<分支名>..develop --oneline
```

## 回滚场景

### 场景 1：功能分支需要撤销

**情况 A**：刚提交但还未合到 develop

```bash
# 取消暂存
git reset HEAD <文件>

# 或重置整个分支
git reset --soft HEAD~1

# 删除分支
git branch -d feat/<分支名>
git push origin --delete feat/<分支名>
```

**情况 B**：已合到 develop，需要撤销合并

```bash
# 查看 merge commit 的哈希值
git log --oneline develop | head -5

# 假设问题提交是 XXXX，重置到上一个稳定点
git reset --hard HEAD~1
git push origin develop --force
```

### 场景 2：develop 基线需要回退

```bash
# 查看最近提交历史
git log -n 10 --oneline develop

# 找到要回退到的提交 YYYY，重置
git checkout develop
git reset --hard YYYY

# 强制推送（仅当确定分支已隔离）
git push origin develop --force-with-lease
```

### 场景 3：main 需要保持纯上游

**重要**：main 永远不允许有功能分支改动

```bash
# 拉取上游并拒绝非 fast-forward 合并
git checkout main
git fetch upstream
git merge --ff-only upstream/main || echo "只允许 forward merge"
git push origin main
```

### 场景 4：错误提交需要完全清理

```bash
# 查看所有分支和远程
git branch -a -v

# 删除本地无用分支（-d = 强制删除已合并的）
git branch -d feat/<清理分支>

# 推送端也清理
git push origin --delete feat/<清理分支>
```

## 回滚安全检查清单

执行任何重置前：

```bash
# 1. 确认影响范围
git log --oneline --graph HEAD~5..HEAD

# 2. 检查远程状态
git remote -v
git status -v

# 3. 备份当前分支
git branch backup/<当前分支>

# 4. 确认要回退的提交
git log --oneline | grep <提交哈希>

# 5. 必要时推送标记以便恢复
git tag v-pre-reset-$(date +%Y%m%d)
```

## 常用回滚命令速查

| 操作 | 命令 |
|------|------|
| 查看差异 | `git diff main` / `git diff develop` |
| 重置暂存区 | `git reset HEAD <文件>` |
| 丢弃更改 | `git restore <文件>` |
| 恢复特定提交 | `git reset --hard <commit>` |
| 删除分支 | `git branch -d <分支名>` |
| 推送清理 | `git push origin --delete <分支名>` |

## 预防措施

- **小步提交**：每个功能拆分成多个 commit，避免大 blob
- **定期清理**：每周检查并删除已合并的功能分支
- **标签标记**：重要版本打 tag，便于回退定位
- **文档同步**：开发前在 `dev-plans/` 登记需求

## 联系支持

如遇到复杂冲突场景：

1. 查阅 [`00-总体方案.md`](../dev-plans/00-总体方案.md) 第 1 节分支模型
2. 参考上游仓库文档：[GitHub CLAUDE.md](https://github.com/BerriAI/litellm/blob/main/CLAUDE.md)
3. 查看本次创建的 `dev-plans/GIT-开发管理规范.md`

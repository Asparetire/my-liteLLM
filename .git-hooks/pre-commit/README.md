# Git Hooks 目录

此目录存放 Git 钩子脚本，会在相关事件时自动触发。

## 现有钩子

### `.git-hooks/pre-commit/i18n-check.txt`

**用途**：在 commit 前检查 UI 汉化是否遗漏美元符号

**使用**：
```bash
git add .
git commit -m "feat: ..."  # 自动触发 i18n 检查
```

## 添加新钩子

### Pre-commit（提交前）

将脚本放入 `.git-hooks/pre-commit/`，内容如：

```bash
#!/bin/sh
# TODO: 在本地测试通过后推送到 origin
echo "预提交检查开始..."
# 自定义检查逻辑
exit 0
```

确保可执行：`chmod +x .git-hooks/pre-commit/<脚本名>`

### Pre-push（推送前）

放入 `.git-hooks/pre-push/`，例如：

```bash
#!/bin/sh
echo "推送前检查..."
git status --short
exit 0
```

## 禁用钩子

临时禁用：
```bash
git config core.hooksPath /dev/null
```

重新启用：
```bash
git config core.hooksPath .git-hooks
```

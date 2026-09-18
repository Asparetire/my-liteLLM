#!/bin/bash
# UI 汉化基建脚本（next-intl 接入）
# 对应需求 02-前端 UI 全面汉化的第 1 天任务

set -e

echo "======================================"
echo "UI 汉化基建 (next-intl 接入)"
echo "======================================"

cd "D:/project/litellm-cn/ui/litellm-dashboard"

# Step 1: 编辑 package.json
echo "[1/4] 在 package.json 中添加 next-intl..."
if ! grep -q '"next-intl"' package.json; then
    # 使用 PowerShell 添加依赖
    powershell -Command "Add-Content -Path 'package.json' -Value ',`n    `"next-intl`": `"^2.2`"`"
    echo "✓ next-intl 已添加到 package.json"
else
    echo "⚠ next-intl 已存在"
fi

# Step 2: npm install（稍后手动执行）
echo "[2/4] 运行 npm install (请手动执行)..."
echo '  请在终端运行：npm install'

# Step 3: 创建目录结构
echo "[3/4] 创建 i18n 目录结构..."
mkdir -p messages i18n

# Step 4: 提取原文到 en.json（简化版，保留硬编码字符串）
echo "[4/4] 创建 en.json 原文映射..."
cat > messages/en.json << 'EOF'
{
  "common": {
    "loading": "加载中...",
    "error": "错误",
    "success": "成功"
  },
  "login": {
    "title": "登录",
    "subtitle": "管理您的 LiteLLM 代理服务器",
    "username": "用户名",
    "password": "密码",
    "button": "登录"
  },
  "navigation": {
    "dashboard": "仪表板",
    "virtualKeys": "虚拟密钥",
    "usage": "用量",
    "budgets": "预算",
    "models": "模型",
    "settings": "设置"
  }
}
EOF

echo "✓ en.json 创建完成"
echo ""
echo "======================================"
echo "UI 汉化基建准备完成！"
echo "======================================"
echo ""
echo "下一步："
echo "1. 手动运行：npm install（或 npm i）"
echo "2. 开始汉化具体页面（见实施计划.md）"
echo ""

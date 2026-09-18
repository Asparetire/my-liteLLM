# 后端错误汉化初始化脚本（PowerShell）
# 对应需求 03-后端错误信息汉化的任务

param(
    [string]$BaseDir = "D:\project\litellm-cn"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "后端错误信息汉化初始化" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

cd $BaseDir

# Step 1: 切换到功能分支
Write-Host ""
Write-Host "[1/5] 切换到 feat/error-i18n-backend 分支..." -ForegroundColor Yellow
git checkout develop
if (-not (git branch --list | Select-String "feat/error-i18n-backend")) {
    Write-Host "创建功能分支..." -ForegroundColor Yellow
    git checkout -b feat/error-i18n-backend
}
git status

# Step 2: 创建 litellm_cn 目录结构
Write-Host ""
Write-Host "[2/5] 创建 litellm_cn 目录结构..." -ForegroundColor Yellow
$litellmCnPath = Join-Path $PSScriptRoot "../litellm_cn"

if (-not (Test-Path $litellmCnPath)) {
    New-Item -ItemType Directory -Force -Path $litellmCnPath | Out-Null
    Write-Host "✓ litellm_cn 目录已创建" -ForegroundColor Green
} else {
    Write-Host "⚠ litellm_cn 已存在" -ForegroundColor Yellow
}

# Step 3: 创建 locale 目录和翻译文件模板
Write-Host ""
Write-Host "[3/5] 创建翻译文件模板..." -ForegroundColor Yellow
$localePath = Join-Path $litellmCnPath "locale"
New-Item -ItemType Directory -Force -Path $localePath | Out-Null

# 创建 en.json（从现有代码抽取的原文示例）
$enJsonTemplate = @{
    "error.rate_limit_exceeded" = "Rate limit exceeded. Please retry after: {retry_after}s"
    "error.model_not_found" = "Model not found: {model}"
    "error.api_key_invalid" = "Invalid API key"
    "error.unauthorized" = "Unauthorized"
    "error.forbidden" = "Forbidden"
    "error.internal_server_error" = "Internal server error"
    "error.bad_request" = "Bad request: {message}"
    "warning.deprecated" = "Deprecated: {method} is deprecated"
    "info.caching_disabled" = "Caching disabled for this endpoint"
} | ConvertTo-Json -Depth 10

$enJsonPath = Join-Path $localePath "en.json"
$enJsonTemplate | Set-Content -Path $enJsonPath -Encoding UTF8
Write-Host "✓ en.json 模板已创建" -ForegroundColor Green

# Step 4: 创建 zh-CN.json（中文翻译）
Write-Host ""
Write-Host "[4/5] 创建 zh-CN.json 翻译文件..." -ForegroundColor Yellow
$zhCnJsonTemplate = @{
    "error.rate_limit_exceeded" = "请求频率限制。请稍后{retry_after}秒重试"
    "error.model_not_found" = "模型不存在：{model}"
    "error.api_key_invalid" = "API key 无效"
    "error.unauthorized" = "未授权访问"
    "error.forbidden" = "禁止访问"
    "error.internal_server_error" = "内部服务器错误"
    "error.bad_request" = "请求错误：{message}"
    "warning.deprecated" = "已废弃：{method} 方法已废弃"
    "info.caching_disabled" = "此端点的缓存已禁用"
} | ConvertTo-Json -Depth 10

$zhCnJsonPath = Join-Path $localePath "zh-CN.json"
$zhCnJsonTemplate | Set-Content -Path $zhCnJsonPath -Encoding UTF8
Write-Host "✓ zh-CN.json 模板已创建" -ForegroundColor Green

# Step 5: 创建 README（翻译指南）
Write-Host ""
Write-Host "[5/5] 创建翻译指南..." -ForegroundColor Yellow
$readmeContent = @'
# LiteLLM CN Fork - 后端错误信息汉化指南

## 说明
此目录存放后端错误信息的中文翻译，通过 FastAPI 中间件拦截响应并替换 error.message。

## 使用方法

### 1. 收集错误消息
运行代理服务器后查看 `litellm.log`，找出最常见的错误消息：

```bash
grep -i "error\|exception\|raise" litellm.log | sort | uniq -c | sort -rn | head -50
```

### 2. 添加翻译条目
在 `locale/zh-CN.json` 中添加新的翻译键，格式：

```json
{
  "error.custom_error_code": "自定义错误消息中文文本"
}
```

### 3. 限制
- 只收录高频错误（前 200-300 条）
- 不要触碰现有 API 字段名（保持英文）
- 未命中的错误原样返回英文，不影响系统功能

## 中间件说明
中间件位于 `litellm_cn/middleware.py`，会在 FastAPI 响应中查找 `error.message` 字段并进行翻译。
'@

$readmePath = Join-Path $localePath "README.md"
$readmeContent | Out-File -FilePath $readmePath -Encoding UTF8
Write-Host "✓ README 已创建" -ForegroundColor Green

# Step 6: 创建 translator.py 模板
Write-Host ""
Write-Host "[额外] 创建 translator.py 模板..." -ForegroundColor Yellow
$translatorContent = @'
"""
后端错误信息翻译模块
提供 translate_message() 函数，将英文错误消息翻译为中文
"""

import json
from pathlib import Path
from typing import Optional

LOCALE_DIR = Path(__file__).parent / "locale"


def load_translations(locale: str = "zh-CN") -> dict:
    """加载指定语言的翻译文件"""
    locale_file = LOCALE_DIR / f"{locale}.json"
    if locale_file.exists():
        with open(locale_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def translate_message(message: str, locale: str = "zh-CN") -> str:
    """
    尝试将英文错误消息翻译为中文

    Args:
        message: 原始英文错误消息
        locale: 目标语言（默认 zh-CN）

    Returns:
        翻译后的消息，若未找到则返回原文
    """
    translations = load_translations(locale)

    # 尝试直接匹配
    key = f"error.{message.lower()}"
    if key in translations:
        return translations[key]

    # 尝试部分匹配（忽略格式参数）
    for template_key, translated_msg in translations.items():
        if message.lower().startswith(template_key.replace("error.", "")):
            return translated_msg

    # 未找到，返回原文
    return message


def get_translated_error(error_data: dict) -> dict:
    """
    翻译 FastAPI 错误响应中的消息

    Args:
        error_data: 包含'message'键的错误数据字典

    Returns:
        翻译后的错误数据字典
    """
    if "message" in error_data:
        error_data = error_data.copy()
        error_data["message"] = translate_message(error_data["message"])

    return error_data


if __name__ == "__main__":
    # 测试示例
    test_messages = [
        "Rate limit exceeded. Please retry after: 60s",
        "Model not found: gpt-4o",
        "Invalid API key",
        "Unknown error message"
    ]

    for msg in test_messages:
        translated = translate_message(msg)
        print(f"原文：{msg}")
        print(f"翻译：{translated}\n")
'@

$translatorPath = Join-Path $litellmCnPath "translator.py"
$translatorContent | Out-File -FilePath $translatorPath -Encoding UTF8
Write-Host "✓ translator.py 模板已创建" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "后端错误汉化初始化完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "1. 运行'git add .' && 'git commit -m feat: 后端错误汉化初始化'"
Write-Host "2. 查看 litellm_cn/locale/zh-CN.json 补充更多翻译"
Write-Host "3. 创建 middleware.py 实现 FastAPI 拦截"
Write-Host ""

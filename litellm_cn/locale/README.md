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

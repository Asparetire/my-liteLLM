# 中文文档

此目录存放用户可见的中文翻译文档，与上游 `docs/` 完全解耦，同步时零冲突。

## 目录结构

```
docs/zh-CN/
├── README.md              # 本文件：索引 + 版本对应关系
├── GIT-开发管理规范.md     # 开发管理规范（自有内容，非译文）
├── QUICK-START.md         # 二开快速开始（自有内容，非译文）
├── getting-started/       # 快速开始 / 部署 / 配置（待创建）
├── proxy/                 # 虚拟密钥、预算与限流、团队与用户（待创建）
├── providers/             # 模型接入（含国内提供商，见 dev-plans/08）（待创建）
└── observability/         # 日志、用量统计、成本追踪（待创建）
```

## 翻译指南

1. **术语表**：使用 dev-plans/04-用户文档汉化.md 第 3 节的统一术语表，确保前后一致
2. **翻译流程**：
   - 先在 dev-plans/04-用户文档汉化.md 中登记需求
   - 翻译完成后放入 docs/zh-CN/<页面名>-zh.md
   - 待合并回 main 分支时批量更新上游 docs/
3. **头部标注**：每篇译文头部标注对应上游文档链接与版本号，便于增量校对

## 文件命名规范

```
<主题>-zh.md    # 中文翻译
<topic>-en.md   # 保留英文原文（回退）
```

## 与上游文档的版本对应关系

| 中文篇目 | 上游文档 | 状态 |
|---|---|---|
| getting-started/quickstart-zh.md | docs.litellm.ai/docs/install | 待创建 |
| proxy/keys-zh.md | docs.litellm.ai/docs/proxy/virtual_keys | 待创建 |
| proxy/budgets-zh.md | docs.litellm.ai/docs/proxy/spend_tracking | 待创建 |
| providers/dashscope-zh.md | 国内提供商接入说明（dev-plans/08） | 待创建 |

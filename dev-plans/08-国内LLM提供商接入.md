# 08 国内 LLM 提供商接入

| 项 | 内容 |
|---|---|
| 需求编号 | REQ-08 |
| 优先级 | P1 |
| 预估工作量 | 2-3 天（配置模板 + 验证，不含深度定制） |
| 前置依赖 | 05（token 权重配置同步落地） |

## 1. 现状

| 事实 | 说明 |
|---|---|
| volcengine（豆包）已有原生 provider | `litellm/llms/volcengine/`（含 chat/embedding/responses transformation） |
| DashScope、千帆、MiniMax、DeepSeek、智谱等 | 多数提供**OpenAI 兼容端点**，无需写代码，用 `openai/<model>` + `api_base` 即可接入 |
| 本地私有模型 | `ollama/`、`ollama_chat/`、`vllm/` 前缀已支持 |
| 计价数据 | 国内模型在 `model_prices_and_context_window.json` 中可能缺失或单价为 0（→ 配额失效），必须按 05 号文档覆盖单价 |

## 2. 接入策略（分三档）

| 档位 | 场景 | 做法 | 成本 |
|---|---|---|---|
| 一档 | 提供商有 OpenAI 兼容端点 | 只写配置 | 0（配置） |
| 二档 | 提供商需自定义请求头/鉴权格式 | 用 `openai/` + `extra_headers`，或写自定义 callbacks 预处理 | 0.5 天 |
| 三档 | 需厂商原生特性（如异步批量、特殊参数、原生 embedding 维度控制） | 新增 `litellm/llms/<provider>/`，参照 `volcengine/` 目录结构实现 `BaseLLM` transformation | 3-5 天/家 |

**默认走一档**：绝大多数场景不需要写代码，也能最大程度降低与上游的冲突面。

## 3. 一档：配置模板

```yaml
model_list:
  # 阿里云百炼 / 通义千问
  - model_name: qwen-max
    litellm_params:
      model: openai/qwen-max
      api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
      api_key: os.environ/DASHSCOPE_API_KEY
      input_cost_per_token: 1.0
      output_cost_per_token: 1.0

  # DeepSeek
  - model_name: deepseek-chat
    litellm_params:
      model: openai/deepseek-chat
      api_base: https://api.deepseek.com/v1
      api_key: os.environ/DEEPSEEK_API_KEY
      input_cost_per_token: 1.0
      output_cost_per_token: 1.0

  # 智谱 GLM
  - model_name: glm-4-plus
    litellm_params:
      model: openai/glm-4-plus
      api_base: https://open.bigmodel.cn/api/paas/v4
      api_key: os.environ/ZHIPU_API_KEY
      input_cost_per_token: 1.0
      output_cost_per_token: 1.0

  # 火山方舟（豆包）—— 原生 provider
  - model_name: doubao-pro
    litellm_params:
      model: volcengine/doubao-pro-32k
      api_key: os.environ/VOLCENGINE_API_KEY
      input_cost_per_token: 1.0
      output_cost_per_token: 1.0

  # 本地部署（Ollama）
  - model_name: local-qwen
    litellm_params:
      model: ollama_chat/qwen3.5:9b
      api_base: http://127.0.0.1:11434
      input_cost_per_token: 1.0
      output_cost_per_token: 1.0
```

要点：

- `api_key` 一律走环境变量（`os.environ/XXX`），不落配置文件明文
- 每个模型**必须**配 token 权重单价，否则 `spend` 恒为 0、配额失效
- 接入后统一挂到 `model_group` / 访问组，便于按部门分配

## 4. 实施步骤

1. 汇总需接入的提供商与模型清单（业务侧提供）
2. 逐个配 `api_base` + 环境变量密钥，起 proxy 做连通性验证（每个模型发一次最小请求）
3. 验证 token 计量：核对 `LiteLLM_SpendLogs` 中该模型的 `prompt_tokens`/`completion_tokens`/`spend` 是否与上游返回的 usage 一致
4. 验证流式响应与非流式响应两种模式（国内提供商流式 usage 字段支持参差不齐，需实测）
5. 验证 function calling / 工具调用（若业务需要）
6. 沉淀为 `config.cn.example.yaml` 模板 + 04 号文档的接入章节

## 5. 需重点验证的差异点

| 差异点 | 说明 |
|---|---|
| 流式 usage 缺失 | 部分提供商流式响应不返回 usage，会致 token 计量为 0 → 需实测，必要时启用客户端估算（注意上游有相关配置） |
| 兼容端点的字段差异 | `tools`、`response_format`、`stream_options` 支持度不一，需逐项实测 |
| 错误码映射 | 兼容端点的错误码与 OpenAI 不一致，可能影响 03 号文档的译文映射（保留英文便于定位） |
| 限流语义 | 提供商侧 TPM/RPM 与网关侧 `tpm_limit` 独立，需文档说明 |

## 6. 三档改造的边界（仅当确有必要）

若必须新增 provider 目录：

- 参照 `litellm/llms/volcengine/` 的组织方式：`chat/transformation.py`、`embedding/`、`common_utils.py`
- 在 `litellm/llms/__init__.py` 与 provider 注册表中登记（这些是上游文件，改动需加 `[CN-FORK]` 标记）
- 必须补测试（沿用 `tests/test_litellm/` 镜像目录规范）
- **评估成本收益**：写 provider 会带来长期冲突成本，能走一档就不要走三档

## 7. 验收标准

- [ ] 清单内所有模型可通过网关正常调用（流式与非流式）
- [ ] token 计量准确（`spend` 与 `total_tokens` 一致）
- [ ] 密钥全部走环境变量
- [ ] 接入模板与文档沉淀完成
- [ ] 至少一个国内模型接入端到端跑通并截图存档

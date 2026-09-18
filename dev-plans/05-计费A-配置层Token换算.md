# 05 计费阶段 A：配置层 Token 换算

| 项 | 内容 |
|---|---|
| 需求编号 | REQ-05 |
| 优先级 | **P0（最高，零改码、当天生效）** |
| 预估工作量 | 0.5 天（含验证） |
| 前置依赖 | 01 仓库基础 |

## 1. 方案原理

LiteLLM 的计费本质是 `spend = Σ(token × 单价)`。只要把每个模型的单价配置为「token 权重系数」，`spend` 的数值就直接等价于**加权 token 数**，于是原有的配额体系（`max_budget` + `budget_duration` + 多级校验 + 429 拒绝）可以原封不动地承担 token 配额职能。

**关键收益：零代码改动、零数据库迁移、完全兼容上游、当天可用。**

## 2. 现状确认（方案依据）

| 事实 | 位置 |
|---|---|
| 单价入口为 `cost_per_token(model, prompt_tokens, completion_tokens, ...)`，入参就是 token 数 | `litellm/cost_calculator.py` |
| 默认单价来自 `model_prices_and_context_window.json`，本地模型通常为 0 → 导致 `spend` 恒为 0、配额失效 | 仓库根 JSON |
| 部署时可用 `input_cost_per_token` / `output_cost_per_token` 覆盖单价 | `model_list` 配置项 |
| 配额校验链路完整：key/team/org/user/global 多级 + Redis 计数 + 周期重置 | `auth_checks.py`、`max_budget_limiter.py`、`reset_budget_job.py` |

## 3. 配置设计

### 3.1 权重方案（推荐：输入 1.0 / 输出 1.0，即纯计数）

```yaml
model_list:
  - model_name: qwen3.5
    litellm_params:
      model: openai/qwen3.5
      api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
      api_key: os.environ/DASHSCOPE_API_KEY
      input_cost_per_token: 1.0      # 1 输入 token 记 1 个配额单位
      output_cost_per_token: 1.0     # 1 输出 token 记 1 个配额单位
```

则：

| 配置 | 语义 |
|---|---|
| `max_budget: 1000000` | 100 万 token 配额 |
| `budget_duration: "30d"` | 每 30 天自动重置 |
| 用量 30 万 token 后 | 剩余 70 万，超出即 429 |

### 3.2 差异化权重（可选）

若希望输出 token 消耗更快：

```yaml
      input_cost_per_token: 1.0
      output_cost_per_token: 3.0    # 输出 token 按 3 倍计
```

此时 `max_budget = 1_000_000` 表示「100 万配额单位」，实际 token 数取决于输入输出比例。**注意**：差异化权重会让「配额数」与「真实 token 数」不一致，UI 展示需要说明口径（见 06 号文档）。

### 3.3 缓存 token 权重

若需对缓存读写单独计价，用：

```yaml
      cache_read_input_token_cost: 0.1
      cache_creation_input_token_cost: 1.25
```

不配置时按普通输入单价计。

## 4. 实施步骤

1. 为 `model_list` 中每个模型补上 `input_cost_per_token` / `output_cost_per_token`
2. 检查是否有全局覆盖：`model_prices_and_context_window.json`（不改该文件，只通过部署配置覆盖）
3. 起 proxy，发一次真实请求，确认 `LiteLLM_SpendLogs.spend` 数值等于该次请求的 token 数（可与同行的 `total_tokens` 列直接比对）
4. 造配额用尽场景：给测试 key 设 `max_budget: 100`，连续请求直到返回 429，确认拒绝生效
5. 验证周期重置：设 `budget_duration: "1d"` 观察 `reset_budget_job` 重置行为

## 5. 验证命令（示意）

```bash
# 发一次请求
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $TEST_KEY" -H "Content-Type: application/json" \
  -d '{"model":"qwen3.5","messages":[{"role":"user","content":"你好"}]}'

# 查询用量，核对 spend == total_tokens
curl -s http://localhost:4000/key/info?key=$TEST_KEY -H "Authorization: Bearer $PROXY_MASTER_KEY"
```

## 6. 已知局限（阶段 B/C 解决）

| 局限 | 解决阶段 |
|---|---|
| UI 上仍显示 `$` 符号与美元语义 | 06（展示层去美元） |
| 配额为浮点数（token 数很大时无精度问题，但语义不够干净） | 07（原生 BigInt 配额） |
| `spend` 字段名仍是金额语义，第三方工具接入需说明 | 07（新增独立字段） |
| 花费有分钟级延迟（Redis 队列 + 批量落库） | 文档说明；关键场景可用预留机制 |

## 7. 验收标准

- [ ] 所有模型均配置 token 权重单价，`spend` 与实际 token 数一致（列比对通过）
- [ ] 配额用尽返回 429，拒绝行为正确
- [ ] `budget_duration` 周期重置生效
- [ ] 无任何代码改动（`git diff` 仅配置文件）
- [ ] 配置模板沉淀进 08 号文档的接入模板

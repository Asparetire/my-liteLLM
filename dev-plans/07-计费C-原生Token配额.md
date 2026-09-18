# 07 计费阶段 C：原生 Token 配额

| 项 | 内容 |
|---|---|
| 需求编号 | REQ-07 |
| 优先级 | P2（阶段 A+B 稳定运行 1 个月后再启动） |
| 预估工作量 | 1-2 周（含测试与 UI） |
| 前置依赖 | 05、06（口径与展示已就绪） |

## 1. 为什么需要这一阶段

阶段 A 用「单价 = 权重系数」把金额语义偷换成 token 语义，代价是：

- 数据库字段仍叫 `max_budget` / `spend`，语义不干净，第三方系统（BI、账单）接入需要额外解释
- 浮点数存储整数配额，长周期累加存在精度顾虑
- UI 需要一层「汇率」心智负担

本阶段新增**原生 token 字段**，与金额体系并存，按字段是否为空自动切换模式。

## 2. 设计原则

1. **并存不替换**：金额字段（`max_budget` / `spend`）原样保留、行为不变；token 字段为 null 时，一切回退到现有金额模式
2. **只增字段**：API 请求/响应只增不改，老客户端零感知
3. **整数精度**：token 全程 `BigInt` 累加，杜绝浮点误差
4. **复用既有机制**：周期重置沿用 `budget_duration` + reset job；预留机制沿用 `budget_reservation`；多级校验沿用现有检查链
5. **迁移只加列**：遵循上游红线（Prisma 迁移在 proxy 启动时同步执行，禁止重写行）

## 3. 数据模型改造

### 3.1 需加字段的表（`litellm/proxy/schema.prisma`）

| 表 | 现有相关字段 | 新增字段 |
|---|---|---|
| `LiteLLM_VerificationToken`（密钥） | `max_budget Float?`、`spend Float`、`tpm_limit BigInt?`、`budget_duration String?` | `max_token_budget BigInt?`、`token_spend BigInt @default(0)` |
| `LiteLLM_UserTable`（用户） | `max_budget Float?`、`spend Float`、`tpm_limit`、`budget_duration` | 同上 |
| `LiteLLM_TeamTable`（团队） | 同上 | 同上 |
| `LiteLLM_OrganizationTable`（组织） | 同上 | 同上 |
| `LiteLLM_TagTable`（标签） | `spend Float` | 同上（按需） |
| `LiteLLM_DeletedKeys` / `LiteLLM_DeletedTeams`（审计表） | 复制了预算相关列 | 同上，保持审计一致性 |

字段定义示例：

```prisma
max_token_budget BigInt?
token_spend      BigInt @default(0)
```

### 3.2 迁移

- 新增迁移 SQL 放 `litellm-proxy-extras/`（沿用仓库既有迁移组织方式）
- 仅 `ALTER TABLE ... ADD COLUMN`，列可空或带默认值，不锁表、不重写行
- 遵循 `tests/code_coverage_tests/check_migrations_no_data_rewrites.py` 的约束
- 上线前在测试库完整演练一次

## 4. 执行逻辑改造

### 4.1 校验链路（`litellm/proxy/auth/auth_checks.py`）

现有预算检查是按作用域分布的多个内部函数（约 650-1130 行区间）：

| 检查函数 | 作用域 | 改造 |
|---|---|---|
| `_global_proxy_budget_check` | 全局 proxy | 一般不改（全局预算仍走金额） |
| `_project_max_budget_check` | 项目 | 加 token 分支 |
| `_user_max_budget_check`（约 1048 行） | 用户 | 加 token 分支 |
| `_team_max_budget_check`（约 1094 行） | 团队 | 加 token 分支 |
| `_organization_max_budget_check`（约 1106 行） | 组织 | 加 token 分支 |
| `_tag_max_budget_check`（约 1113 行） | 标签 | 加 token 分支 |
| `_model_access_group_max_budget_check`（约 1120 行） | 模型访问组 | 加 token 分支 |

分支逻辑（每个检查函数内）：

```
if entity.max_token_budget is not None:
    当前用量 = 读 Redis 计数器 token_spend:<scope>:<id>（未命中回退数据库 token_spend）
    if 当前用量 >= entity.max_token_budget: 抛出预算超限异常（沿用现有异常类型与状态码 429）
    return   # token 模式下不再走金额判断
# 以下为原有金额逻辑，保持不变
```

关键点：**沿用现有异常类型与 `RateLimitType.BUDGET`**，不新增错误类型，保证客户端与监控无感知。

### 4.2 请求前置钩子（`litellm/proxy/hooks/max_budget_limiter.py`）

该文件负责 user 级 pre-call 预算校验，当前逻辑：

- 读 Redis 计数器 `spend:user:{user_id}`（`get_current_spend`）
- 与 `user_max_budget` 比较，超限抛 `ProxyRateLimitError(rate_limit_type=BUDGET)`
- 已接入 `budget_reservation` 预留机制（避免并发下的边界误判）

改造：

1. 新增计数器 key `token_spend:user:{user_id}`
2. `user_api_key_dict` 增加 `user_max_token_budget` 透传（来自 `UserAPIKeyAuth`）
3. 判定顺序：`max_token_budget` 非空 → token 比较；否则走原金额比较
4. 预留机制同步支持 token 计数（复用 `get_reserved_counter_keys`）

> `UserAPIKeyAuth` 类型定义在 `litellm/proxy/_types.py`，需新增 `max_token_budget` / `token_spend` 字段（可选，默认 None）

### 4.3 计量埋点（`litellm/proxy/hooks/proxy_track_cost_callback.py`）

- 请求完成后，除现有 `spend` 累加外，**双写** token 计数：
  - Redis：`INCRBY token_spend:<scope>:<id> <total_tokens>`
  - 数据库：随 `update_spend` 批量落库（沿用现有 60 秒批量机制，不新增写入路径）
- token 口径：`usage.total_tokens`（= prompt + completion）；若需按缓存差异计权，读取 `cache_read_input_tokens` / `cache_creation_input_tokens` 并按配置加权
- **整数写入**：确保累加值为 int，避免浮点

### 4.4 周期重置（`litellm/proxy/common_utils/reset_budget_job.py`）

- `budget_duration` 到期时，除重置 `spend` 外重置 `token_spend = 0`
- 同步清理 Redis 计数器 `token_spend:*`

### 4.5 管理端点（API 层）

| 文件 | 改动 |
|---|---|
| `litellm/proxy/management_endpoints/key_management_endpoints.py` | `/key/generate`、`/key/update`、`/key/info` 支持 `max_token_budget` 入参与 `token_spend` 出参 |
| `litellm/proxy/management_endpoints/internal_user_endpoints.py` | 用户管理同理 |
| `litellm/proxy/management_endpoints/team_endpoints.py` | 团队同理 |
| `litellm/proxy/management_endpoints/organization_endpoints.py` | 组织同理 |
| `litellm/proxy/_types.py` | `UserAPIKeyAuth`、各请求模型加可选字段 |

统一约束：**只增字段**，字段可空，未传时不改变任何现有行为。

## 5. UI 改造

| 文件 | 改动 |
|---|---|
| `src/app/(dashboard)/budgets/_components/budget_modal.tsx` | 表单增加「配额类型」选择（Token 配额 / 金额预算）；选 Token 时提交 `max_token_budget` |
| `src/app/(dashboard)/budgets/_components/edit_budget_modal.tsx` | 同上（编辑态） |
| `src/app/(dashboard)/budgets/_components/BudgetTableColumns.tsx`、`BudgetTable.tsx` | 展示 token 配额与用量，进度条按 `token_spend / max_token_budget` |
| `src/components/shared/table_cells/spend_budget_cell.tsx` | 兼容两种模式的展示分支 |
| `src/components/templates/key_edit_view.tsx`、`key_info_view.tsx` | 密钥配额字段与展示 |
| `src/app/(dashboard)/users/_components/view_users/user_info_view.tsx`、`user_edit_view.tsx` | 用户配额 |
| `src/components/team/TeamInfo.tsx`、`src/app/(dashboard)/organizations/_components/OrgSettingsForm.tsx` | 团队/组织配额 |
| `src/components/key_team_helpers/ModelMaxBudgetEditor.tsx`、`AccessGroupBudgetModal.tsx` | 按模型/模型组配额 |
| `src/lib/http/schema.d.ts` | 由 `npm run gen:api` 重新生成（**不手改**） |

展示规则：token 模式下单位显示 `tokens`，金额模式下保持原样（渐进迁移，未配置 token 配额的实体不受影响）。

## 6. 测试要求

上游已有完善的预算测试基建，**扩展既有测试文件**而非新建：

| 测试文件 | 需补充的用例 |
|---|---|
| `tests/test_litellm/proxy/hooks/test_max_budget_limiter.py` | token 模式超限拒绝；token 字段为 null 时走金额逻辑（回归保护） |
| `tests/test_litellm/proxy/auth/test_auth_checks.py` | key/team/org 各级 token 配额校验 |
| `tests/test_litellm/proxy/common_utils/test_reset_budget_job.py` | token_spend 随周期重置 |
| `tests/e2e/quota_management/budgets/` | 新增 token 配额端到端用例（参照 `test_budget_enforcement_e2e.py` 的写法） |

必须覆盖的回归点：

1. `max_token_budget` 为 null 时，行为与改造前**逐字节一致**
2. token 累加为整数，多次请求后数值精确等于各次 `total_tokens` 之和
3. 并发场景下预留机制生效，不会超卖（参照 `test_budget_reservation.py`）
4. 老数据（仅有金额字段）读取正常，API 响应不含 token 字段或为 null

## 7. 兼容性与回退

- **回退开关**：所有 `max_token_budget` 置空即完全回到金额模式，无需回滚代码
- **Redis 清理**：切换模式时在停机窗口 flush `token_spend:*` key
- **老客户端**：响应只增字段，解析逻辑不受影响

## 8. 验收标准

- [ ] token 模式下配额精确到个位，超出返回 429
- [ ] 金额模式下行为与改造前一致（回归测试全绿）
- [ ] 老数据可读、可继续累加金额
- [ ] 周期重置同时清零 `token_spend` 与金额 `spend`
- [ ] API 响应只增字段（diff 对比验证）
- [ ] `make test-unit` 全绿；e2e 预算用例通过
- [ ] Prisma 迁移在测试库演练通过，`check_migrations_no_data_rewrites.py` 通过

## 9. 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| 迁移在 proxy 启动时执行，失败影响启动 | 中 | 只加 nullable 列；测试库演练；备份先行 |
| 触碰 `auth_checks.py` 等核心文件，冲突概率高 | 中 | 改动集中在各检查函数内部 + `[CN-FORK]` 标记；保持改动最小（只加分支不动原逻辑） |
| Redis 与 DB 计数不一致 | 中 | 以 Redis 为准做实时校验，DB 做持久化；不一致时以较大的用量值判定（保守策略） |
| 缓存 token 口径争议 | 低 | 口径写进用户文档；配置项暴露权重让使用方自选 |

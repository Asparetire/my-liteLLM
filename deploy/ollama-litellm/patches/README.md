# Ollama prompt cache 计数补丁

让网关把 Ollama 的缓存命中数透出给客户端，使 Claude Code / CCswitch 的
「缓存创建 / 缓存命中」不再是 0。

---

## 1. 症状

CCswitch（以及任何读 Anthropic `usage` 的客户端）里，缓存创建和缓存命中恒为 0。

网关 `/v1/messages` 的真实 SSE 长这样：

```
event: message_start
data: {...,"usage":{"input_tokens":0,"output_tokens":0,
                    "cache_creation_input_tokens":0,"cache_read_input_tokens":0}}

event: message_delta
data: {"delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":999,"output_tokens":104}}
```

`message_delta` 里连 `cache_*` 两个字段都没有。

## 2. 根因

**不是 Ollama 没缓存，是 LiteLLM 把字段丢了。**

直连 Ollama `/api/chat`，同一段 ~1200 token 前缀连打两次，末尾 chunk 返回：

| 第几次 | `prompt_eval_count` | `prompt_eval_cached_count` | 说明 |
|---|---|---|---|
| 第 1 次 | 1223 | **0** | 冷启动，全部现算 |
| 第 2 次 | 1223 | **1219** | 命中 99.7% |

Ollama 的缓存是真在工作的（`OLLAMA_KEEP_ALIVE=24h`，`NUM_PARALLEL=1`）。

但 LiteLLM 的 Ollama 适配层只读 `prompt_eval_count` / `eval_count`：

- `litellm/llms/ollama/chat/transformation.py`
  - `OllamaChatConfig.transform_response()` —— 非流式
  - `OllamaChatCompletionResponseIterator.chunk_parser()` —— 流式（Claude Code 走这条）
- `litellm/llms/ollama/completion/transformation.py` —— `/api/generate` 路径，同理

`prompt_eval_cached_count` 在 LiteLLM 源码里**搜不到任何引用**，就是在这里被丢掉的。

有意思的是，下游其实全都准备好了 —— Anthropic 适配层本来就会读这些字段：

```
litellm/llms/anthropic/experimental_pass_through/adapters/transformation.py
    _get_cache_read_input_tokens()      读 usage.prompt_tokens_details.cached_tokens
    _get_cache_creation_input_tokens()  读 usage.prompt_tokens_details.cache_creation_tokens
    _translate_openai_usage_to_anthropic_usage_delta()
        input_tokens = prompt_tokens - cache_read - cache_creation
```

**断点只有一处：Ollama 适配层没把 `prompt_eval_cached_count` 填进
`usage.prompt_tokens_details`。**

## 3. 补丁做了什么

猴补丁上面两个方法，把字段塞进 `usage.prompt_tokens_details`，之后**不用再动任何
别的地方**，LiteLLM 自带的适配层会把剩下的活干完。

字段映射（Ollama 口径 → Anthropic 口径）：

| Anthropic 字段 | 取值 | 含义 |
|---|---|---|
| `cache_read_input_tokens` | `prompt_eval_cached_count` | 命中 |
| `cache_creation_input_tokens` | `prompt_eval_count - cached` | 本次现算并写入缓存 |
| `input_tokens` | `0` | 见下方说明 |

两者相加恰好等于 `prompt_eval_count`，所以 `input_tokens` 是 0 —— 这与 Anthropic
自己的口径一致：Anthropic 的 `input_tokens` 本来就不含 cached / creation 部分，
三者相加才是完整 prompt。

> Ollama 不区分「缓存创建 vs 命中」，补丁用「未命中 = 现算 = 写入缓存」来近似
> Anthropic 的 cache_creation 语义。这是业界通行做法（DeepSeek 的
> `prompt_cache_miss_tokens`、GLM / Kimi 等的 OpenAI 兼容接口都这么表达 cache write）。
> 如果不想要这层近似，把 `LITELLM_OLLAMA_CACHE_CREATION` 设为 `0`，未命中的部分就
> 会留在 `input_tokens` 里。

## 4. 安装

`docker-compose.yml` 里已经配好，两条：

```yaml
    volumes:
      - ./patches:/app/patches:ro          # 挂补丁
    environment:
      PYTHONPATH: /app/patches             # 让解释器自动加载 sitecustomize
      LITELLM_OLLAMA_CACHE_CREATION: "1"
```

生效：

```bash
cd ~/ollama-litellm
docker compose up -d litellm      # 重建容器（改了 environment，restart 不够）
```

**为什么用 `sitecustomize` + `PYTHONPATH` 而不是直接盖 `transformation.py`：**

- 挂载路径不含 Python 版本号，镜像把 python3.13 升到 3.14 也不用改；
- 覆盖整个源文件的话，镜像一升级就是「旧文件 + 新解释器」，可能直接语法报错让
  网关起不来；猴补丁最坏只是静默不生效，不会拖垮服务；
- 补丁装在 `try/except` 里，装不上只往 stderr 打一行，不影响启动。

## 5. 验证

```bash
# 1) 补丁是否装上了
docker exec -e PYTHONPATH=/app/patches litellm python3 -c \
  "import sitecustomize; from litellm.llms.ollama.chat.transformation import OllamaChatConfig as C; \
   print(getattr(C, '_ollama_prompt_cache_patched', False))"
# 期望输出 True

# 2) 端到端：跑两次同样的长前缀，看 message_delta
python3 cc-stream-dump.py
# 期望 message_delta 的 usage 里出现非 0 的 cache_read_input_tokens
# 注意：前缀必须完全一致才会命中，且模型要留在显存里（keep_alive=24h）
```

第 2 次起应该能看到类似：

```json
"usage": {"input_tokens": 0, "output_tokens": 104,
          "cache_creation_input_tokens": 4, "cache_read_input_tokens": 1219}
```

## 6. 卸载

注释掉 `docker-compose.yml` 里的 `PYTHONPATH`、`LITELLM_OLLAMA_CACHE_CREATION` 和
`./patches` 挂载，然后 `docker compose up -d litellm`。镜像本身没被改过，无需其它操作。

## 7. 已知边界

- 只覆盖 **chat 路径**（`ollama_chat/` 前缀，走 `/api/chat`）。当前配置里所有模型
  都是 `ollama_chat/`，够用；`/api/generate` 的 completion 路径没覆盖。
- 缓存命中要求**前缀逐 token 一致**。system prompt 或历史里任何一处变了，从那里
  往后全部算未命中 —— 这与 Anthropic 的缓存语义一致，不是 bug。
- 命中数依赖 Ollama 把模型留在显存里。模型被换出（`OLLAMA_MAX_LOADED_MODELS=1`
  导致切模型重载）时缓存清零，属预期行为。
- 若将来 LiteLLM 上游自己支持了 `prompt_eval_cached_count`，本补丁会与其叠加；
  到时把 `LITELLM_OLLAMA_PROMPT_CACHE` 设为 `0` 即可停用。
- 副作用：每个容器内的 python 进程启动时会多花约 2.6 秒 import litellm（包括
  compose 里那个 30 秒一次的 healthcheck）。网关本身本来就要 import，实际无感。

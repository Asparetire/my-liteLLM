"""Ollama prompt-cache 用量补丁 —— 以 sitecustomize 方式在解释器启动时自动加载。

【为什么需要它】
Ollama 的 /api/chat 在最后一个 chunk（done=true）里会返回两个计数字段：

    prompt_eval_count         本次 prompt 的总 token 数
    prompt_eval_cached_count  其中命中 Ollama 自身 KV cache 的 token 数

实测（qwen38-iq3s，同一段 1200 token 前缀连打两次）：

    第 1 次   prompt_eval_count=1223  prompt_eval_cached_count=0
    第 2 次   prompt_eval_count=1223  prompt_eval_cached_count=1219   ← 命中 99.7%

也就是说 Ollama 侧的缓存是真生效的。但 LiteLLM 的 Ollama 适配层只读
prompt_eval_count / eval_count：

    litellm/llms/ollama/chat/transformation.py
        transform_response()   非流式，构造 usage 时只取这两个字段
        chunk_parser()         流式，同上
    litellm/llms/ollama/completion/transformation.py  同理（/api/generate 路径）

prompt_eval_cached_count 被直接丢弃 → 网关 /v1/messages 返回的 usage 永远只有
input_tokens / output_tokens → Claude Code / CCswitch 的「缓存创建 / 缓存命中」
永远是 0，尽管 Ollama 明明命中了 99%。

【它做了什么】
猴补丁上面两个方法，把 prompt_eval_cached_count 塞进 LiteLLM 认识的
usage.prompt_tokens_details。之后**不需要再改任何别的地方** —— LiteLLM 自带的
Anthropic 适配层本来就会读这个字段：

    litellm/llms/anthropic/experimental_pass_through/adapters/transformation.py
        _get_cache_read_input_tokens()      读 prompt_tokens_details.cached_tokens
        _get_cache_creation_input_tokens()  读 prompt_tokens_details.cache_creation_tokens
        _translate_openai_usage_to_anthropic_usage_delta()
            input_tokens = prompt_tokens - cache_read - cache_creation

字段映射（Ollama 口径 -> Anthropic 口径）：

    cache_read_input_tokens     = prompt_eval_cached_count            命中
    cache_creation_input_tokens = prompt_eval_count - cached          本次新算并写入缓存
    input_tokens                = 0

两者相加恰好等于 prompt_eval_count，所以 input_tokens 为 0 —— 这与 Anthropic
自己的口径一致：Anthropic 的 input_tokens 本来就不含 cached / creation 的部分，
三者相加才是完整 prompt。副作用是 Anthropic 侧的「纯新增输入」会显示为 0，
如果更希望未命中的部分留在 input_tokens 里，把下面
LITELLM_OLLAMA_CACHE_CREATION 设为 0 即可。

【环境变量】
    LITELLM_OLLAMA_PROMPT_CACHE=0     整个补丁不生效（默认 1）
    LITELLM_OLLAMA_CACHE_CREATION=0   不上报 cache_creation_tokens（默认 1）

【安装方式】
本文件被挂载进容器，并靠 PYTHONPATH 让解释器把它当 sitecustomize 加载。详见同
目录 README.md；docker-compose.yml 里对应的两行是 PYTHONPATH 与 ./patches 挂载。

【注意】
- 只覆盖 Ollama 的 chat 路径（ollama_chat/ 前缀，走 /api/chat）。内置配置里所有
  模型都用 ollama_chat/，所以够用；/api/generate 的 completion 路径未覆盖。
- Ollama 不区分「缓存的创建与命中」，本补丁用「未命中 = 新算 = 写入缓存」来近似
  Anthropic 的 cache_creation 语义，这是约定俗成的做法（DeepSeek / GLM / Kimi 等
  OpenAI 兼容接口同样用 cache_miss 来表达 cache write）。
"""

from __future__ import annotations

import os
import sys

_TARGET_MODULE = "litellm.llms.ollama.chat.transformation"
_MARK = "_ollama_prompt_cache_patched"
_FALSY = {"0", "false", "no", "off"}


def _env_flag(name: str, default: str = "1") -> bool:
    return os.environ.get(name, default).strip().lower() not in _FALSY


def _extract_details(payload: object) -> dict | None:
    """从 Ollama 响应里取出缓存计数，组装成 prompt_tokens_details。取不到返回 None。"""
    if not isinstance(payload, dict):
        return None
    total = payload.get("prompt_eval_count")
    cached = payload.get("prompt_eval_cached_count")
    if total is None or cached is None:
        return None
    try:
        total = int(total)
        cached = int(cached)
    except (TypeError, ValueError):
        return None
    if total < 0 or cached < 0:
        return None

    details: dict = {"cached_tokens": cached}
    if _env_flag("LITELLM_OLLAMA_CACHE_CREATION"):
        miss = total - cached
        if miss > 0:
            details["cache_creation_tokens"] = miss
    return details


def _attach(container: object, details: dict) -> None:
    """把 details 挂到 container.usage 上（流式是 Usage 对象，非流式也是 Usage）。"""
    usage = getattr(container, "usage", None)
    if usage is None:
        return

    value: object = dict(details)
    try:
        from litellm.types.utils import PromptTokensDetailsWrapper

        value = PromptTokensDetailsWrapper(**{k: v for k, v in details.items() if v is not None})
    except Exception:
        # 拿不到 LiteLLM 的类型就退化成普通 dict —— 适配层对 dict 同样能读
        pass

    try:
        if isinstance(usage, dict):
            usage["prompt_tokens_details"] = value
        else:
            usage.prompt_tokens_details = value
    except Exception:
        pass


def _install() -> None:
    import importlib

    module = sys.modules.get(_TARGET_MODULE) or importlib.import_module(_TARGET_MODULE)
    config_cls = module.OllamaChatConfig
    iterator_cls = module.OllamaChatCompletionResponseIterator

    if getattr(config_cls, _MARK, False):
        return

    # ---- 非流式 ----
    original_transform_response = config_cls.transform_response

    def transform_response(self, model, raw_response, model_response, *args, **kwargs):
        result = original_transform_response(self, model, raw_response, model_response, *args, **kwargs)
        try:
            details = _extract_details(raw_response.json())
        except Exception:
            details = None
        if details:
            _attach(result, details)
        return result

    transform_response.__name__ = original_transform_response.__name__
    transform_response.__doc__ = original_transform_response.__doc__
    config_cls.transform_response = transform_response

    # ---- 流式（Claude Code 走这条）----
    original_chunk_parser = iterator_cls.chunk_parser

    def chunk_parser(self, chunk):
        result = original_chunk_parser(self, chunk)
        details = _extract_details(chunk)
        if details:
            _attach(result, details)
        return result

    chunk_parser.__name__ = original_chunk_parser.__name__
    chunk_parser.__doc__ = original_chunk_parser.__doc__
    iterator_cls.chunk_parser = chunk_parser

    setattr(config_cls, _MARK, True)


if _env_flag("LITELLM_OLLAMA_PROMPT_CACHE"):
    try:
        _install()
    except Exception:  # noqa: BLE001 - 补丁失败绝不能拖垮网关
        import traceback

        print("[ollama-prompt-cache] 补丁安装失败，已跳过：", file=sys.stderr)
        traceback.print_exc()

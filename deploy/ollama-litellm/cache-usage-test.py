"""验证网关是否把 Ollama 的缓存命中透出成 Anthropic 的 cache_* 字段。

同一段前缀连打 3 次（流式），看每次 message_delta 的 usage：
    第 1 次  cache_read=0，cache_creation≈全量      （冷启动）
    第 2/3 次 cache_read≈全量，cache_creation≈0    （命中）
用法: GATEWAY_KEY=sk-xxx python cache-usage-test.py [模型名]
密钥从环境变量 GATEWAY_KEY 读取（不要写死在文件里，本目录会进 git）。
"""

import json
import os
import sys
import urllib.request

URL = os.environ.get("GATEWAY_URL", "http://192.168.100.123:4000") + "/v1/messages"
KEY = os.environ.get("GATEWAY_KEY", "")
MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen38-iq3s"

# 前缀必须逐 token 一致才会命中
SYSTEM = "你是一个严谨的助手。" + "以下是项目背景资料，请通读后再回答。" * 120

PAYLOAD = {
    "model": MODEL,
    "max_tokens": 16,
    "stream": True,
    "system": SYSTEM,
    "messages": [{"role": "user", "content": "只回答两个字：收到"}],
}

_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def call_once(idx: int) -> dict | None:
    req = urllib.request.Request(
        URL,
        data=json.dumps(PAYLOAD).encode(),
        headers={
            "Content-Type": "application/json",
            "x-api-key": KEY,
            "anthropic-version": "2023-06-01",
        },
    )
    usage = None
    with _OPENER.open(req, timeout=600) as r:
        for line in r:
            line = line.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                event = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            if event.get("type") == "message_delta" and event.get("usage"):
                usage = event["usage"]
    print(f"第 {idx} 次  message_delta.usage = {json.dumps(usage, ensure_ascii=False)}")
    return usage


def main() -> int:
    if not KEY:
        print("请先设置环境变量 GATEWAY_KEY（虚拟 key，见 README-USAGE.md）")
        return 2
    print(f"模型: {MODEL}   前缀约 {len(SYSTEM)} 字\n")
    results = [call_once(i) for i in range(1, 4)]
    print()
    last = results[-1] or {}
    read = last.get("cache_read_input_tokens", 0)
    if read > 0:
        print(f"通过：第 3 次命中 {read} token，网关已上报缓存命中。")
        return 0
    print("未命中：检查前缀是否完全一致、模型是否被换出显存、补丁是否生效。")
    return 1


if __name__ == "__main__":
    sys.exit(main())

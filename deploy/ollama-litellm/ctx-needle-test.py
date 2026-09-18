"""通过 LiteLLM 网关验证长上下文是否真正生效（needle-in-haystack 测试）。

原理：把关键词埋在超长 prompt 的开头。若网关或 Ollama 把上下文截断到较小值，
关键词会落在截断区之外，模型就答不出来。

用法（在服务器上执行）：
    python3 ctx-needle-test.py [模型名] [填充倍数]
默认：qwen3.5 / 5000（约 7 万 token，足以越过 32768 边界）
"""
import json
import sys
import time
import urllib.request

GATEWAY = "http://127.0.0.1:4000"
KEY = "sk-faa0a978f90a86ff743e1680416a53089ad5b71866d27fcf"
NEEDLE = "菠萝蜜"

model = sys.argv[1] if len(sys.argv) > 1 else "qwen3.5"
repeat = int(sys.argv[2]) if len(sys.argv) > 2 else 5000

filler = "这是一段用于填充上下文的测试文本，内容本身没有意义。" * repeat
prompt = (
    f"请记住这个词：{NEEDLE}。\n"
    f"{filler}\n"
    f"问题：上面我让你记住的那个词是什么？只回答那个词，不要解释。"
)

body = {
    "model": model,
    "messages": [{"role": "user", "content": prompt}],
    "max_tokens": 32,
    "temperature": 0,
}
req = urllib.request.Request(
    GATEWAY + "/v1/chat/completions",
    data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
)

print("模型:", model)
print("发送字符数:", len(prompt))
t0 = time.time()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    with opener.open(req, timeout=1800) as resp:
        data = json.loads(resp.read().decode())
except Exception as exc:
    print("请求失败:", type(exc).__name__, exc)
    sys.exit(1)

usage = data.get("usage", {})
prompt_tokens = usage.get("prompt_tokens") or 0
try:
    text = data["choices"][0]["message"]["content"]
except Exception:
    text = "(无正文)"

print("prompt_tokens:", prompt_tokens)
print("completion_tokens:", usage.get("completion_tokens"))
print("回答:", repr(text))
print("总耗时: %.1fs" % (time.time() - t0))
print()
if prompt_tokens > 32768:
    print("[OK] prompt_tokens=%d 已越过 32768，上下文未被截断" % prompt_tokens)
else:
    print("[WARN] prompt_tokens=%d 未超过 32768，本次没触及边界，请加大填充倍数" % prompt_tokens)
if NEEDLE in (text or ""):
    print("[OK] 正确取回埋在开头的关键词，长上下文完整生效")
else:
    print("[FAIL] 未取回关键词（期望包含 %s）" % repr(NEEDLE))

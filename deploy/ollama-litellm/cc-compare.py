"""模拟 Claude Code 请求：对比 thinking 开/关两种情况下的返回"""
import json, sys, time, urllib.request

URL = "http://192.168.100.123:4000/v1/messages"
KEY = "sk-M2xHWn5eE1cpymYXZDnFxg"
BASE = json.load(open("cc-sim-test.json", encoding="utf-8"))

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def call(payload, label):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        URL, data=data,
        headers={"Content-Type": "application/json", "x-api-key": KEY,
                 "anthropic-version": "2023-06-01"})
    t0 = time.time()
    try:
        with opener.open(req, timeout=300) as r:
            d = json.loads(r.read().decode())
    except Exception as e:
        print(f"[{label}] 请求失败 {time.time()-t0:.1f}s: {e}")
        return
    dt = time.time() - t0
    print(f"\n[{label}] HTTP {r.status}  {dt:.1f}s")
    print(f"  stop_reason: {d.get('stop_reason')}")
    print(f"  usage      : {d.get('usage')}")
    for b in d.get("content", []):
        t = b.get("type")
        if t == "thinking":
            print(f"  thinking   : {len(b.get('thinking',''))} 字符 -> {b.get('thinking','')[:100]}...")
        elif t == "tool_use":
            print(f"  tool_use   : {b.get('name')} {str(b.get('input'))[:120]}")
        elif t == "text":
            txt = b.get("text", "")
            print(f"  TEXT       : {len(txt)} 字符 -> {txt[:200]}")


# 场景 1：Claude Code 默认（带 extended thinking）
p1 = dict(BASE)
p1["thinking"] = {"type": "enabled", "budget_tokens": 10000}
call(p1, "带 thinking enabled")

# 场景 2：关闭 thinking
p2 = dict(BASE)
call(p2, "不带 thinking")

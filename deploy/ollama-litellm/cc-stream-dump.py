"""dump Anthropic 流式原始字节，确认 SSE 格式"""
import json, time, urllib.request

URL = "http://192.168.100.123:4000/v1/messages"
KEY = "sk-M2xHWn5eE1cpymYXZDnFxg"
BASE = json.load(open("cc-sim-test.json", encoding="utf-8"))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

p = dict(BASE)
p["stream"] = True
req = urllib.request.Request(
    URL, data=json.dumps(p).encode(),
    headers={"Content-Type": "application/json", "x-api-key": KEY,
             "anthropic-version": "2023-06-01"})

t0 = time.time()
with opener.open(req, timeout=180) as r:
    print("HTTP", r.status)
    print("Content-Type:", r.headers.get("content-type"))
    print("Transfer-Encoding:", r.headers.get("transfer-encoding"))
    raw = r.read()
dt = time.time() - t0
print(f"耗时 {dt:.1f}s   总字节 {len(raw)}")
print("--- 原始输出（前 3000 字节）---")
print(raw[:3000].decode(errors="replace"))
print("--- 尾部 800 字节 ---")
print(raw[-800:].decode(errors="replace"))

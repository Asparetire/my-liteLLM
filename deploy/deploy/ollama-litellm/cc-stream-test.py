"""检查 Anthropic 流式 SSE 事件序列是否完整 —— Claude Code 依赖完整事件序列"""
import json, time, urllib.request

URL = "http://192.168.100.123:4000/v1/messages"
KEY = "sk-M2xHWn5eE1cpymYXZDnFxg"
BASE = json.load(open("cc-sim-test.json", encoding="utf-8"))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def stream(model, use_thinking):
    p = dict(BASE)
    p["model"] = model
    p["stream"] = True
    if use_thinking:
        p["thinking"] = {"type": "enabled", "budget_tokens": 10000}
    else:
        p.pop("thinking", None)

    print(f"\n=== model={model}  thinking={use_thinking} ===")
    req = urllib.request.Request(
        URL, data=json.dumps(p).encode(),
        headers={"Content-Type": "application/json", "x-api-key": KEY,
                 "anthropic-version": "2023-06-01"})

    events = []
    t0 = time.time()
    try:
        with opener.open(req, timeout=180) as r:
            print(f"  HTTP {r.status}  content-type={r.headers.get('content-type')}")
            buf = b""
            while True:
                chunk = r.read(1)
                if not chunk:
                    break
                buf += chunk
                if buf.endswith(b"\n\n"):
                    line = buf.decode(errors="replace").strip()
                    buf = b""
                    if line.startswith("event:"):
                        continue
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            events.append("[DONE]")
                            continue
                        try:
                            d = json.loads(payload)
                            events.append(d.get("type", "?"))
                        except Exception:
                            events.append("UNPARSEABLE")
    except Exception as e:
        print(f"  流式异常 {time.time()-t0:.1f}s: {e}")

    dt = time.time() - t0
    print(f"  总耗时 {dt:.1f}s   共收到 {len(events)} 个事件")
    print("  事件序列:", " -> ".join(events[:40]))
    has_stop = "message_stop" in events
    print(f"  ✅ 含 message_stop" if has_stop else "  ❌ 缺少 message_stop —— 客户端会一直等待")


stream("qwen3-8b", False)
stream("qwen3-8b", True)

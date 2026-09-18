"""测试长上下文：Claude Code 真实请求远超 999 token，验证 num_ctx 是否够用"""

import json, time, urllib.request

URL = "http://192.168.100.123:4000/v1/messages"
KEY = "sk-M2xHWn5eE1cpymYXZDnFxg"
BASE = json.load(open("cc-sim-test.json", encoding="utf-8"))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

# 生成接近真实规模的填充文本，模拟 Claude Code 的长系统提示词
FILLER = (
    "When operating as an agent you must follow these guidelines precisely. "
    "Always prefer using the dedicated tools over shell commands when a tool exists for the task. "
    "Before editing any file ensure you have read it completely. Remember to keep responses concise "
    "and avoid unnecessary preamble. Never fabricate file paths or command output. "
    "If the user asks for a change that would break existing behavior, call out the risk explicitly. "
    "When writing Python code follow PEP8, annotate types, and include concise docstrings. "
    "When writing shell scripts prefer POSIX compliant syntax and quote all variable expansions. "
    "Always verify your assumptions against the actual repository contents before acting. "
)

TOOL = {
    "name": "GenericTool",
    "description": "A placeholder tool used to inflate the tool definition payload so that the "
                   "request mirrors the token footprint of a real Claude Code session.",
    "input_schema": {
        "type": "object",
        "properties": {
            "target": {"type": "string", "description": "Target identifier for this operation."},
            "options": {"type": "object", "description": "Additional options controlling behaviour."},
            "flags": {"type": "array", "items": {"type": "string"}, "description": "Behavioural flags."},
            "dry_run": {"type": "boolean", "description": "Preview without applying changes."},
        },
        "required": ["target"],
    },
}


def build(target_chars):
    p = dict(BASE)
    core = BASE["system"][0]["text"]
    while len(core) < target_chars:
        core += FILLER
    p["system"] = [{"type": "text", "text": core}]
    # 同时把工具列表撑大，模拟真实会话里十几个工具的开销
    tools = list(BASE["tools"])
    i = 0
    while len(json.dumps(tools)) < target_chars:
        t = dict(TOOL)
        t["name"] = f"GenericTool{i}"
        tools.append(t)
        i += 1
    p["tools"] = tools
    return p


def call(p, label):
    t0 = time.time()
    req = urllib.request.Request(
        URL, data=json.dumps(p).encode(),
        headers={"Content-Type": "application/json", "x-api-key": KEY,
                 "anthropic-version": "2023-06-01"})
    try:
        with opener.open(req, timeout=300) as r:
            d = json.loads(r.read().decode())
    except Exception as e:
        print(f"[{label}] 失败 {time.time()-t0:.1f}s: {e}")
        return
    dt = time.time() - t0
    print(f"\n[{label}] {dt:.1f}s  stop_reason={d.get('stop_reason')}")
    print(f"  usage: {d.get('usage')}")
    for b in d.get("content", []):
        if b.get("type") == "thinking":
            print(f"  thinking({len(b.get('thinking',''))}字符): {b.get('thinking','')[:80]}...")
        elif b.get("type") == "tool_use":
            print(f"  tool_use: {b.get('name')} {str(b.get('input'))[:150]}")
        elif b.get("type") == "text":
            print(f"  TEXT({len(b.get('text',''))}字符): {b.get('text','')[:200]}")


for chars in (12000, 40000):
    p = build(chars)
    est = chars // 3 + len(json.dumps(p["tools"])) // 3
    call(p, f"system≈{chars}字符 总计约{est}token")

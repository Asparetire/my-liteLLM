"""端到端测试：启动真实代理 + 触发 401 错误响应 -> 验证中文翻译。

用法（在仓库根目录）：
    LITELLM_MASTER_KEY=sk-test-e2e python -m litellm_cn.test_e2e

流程：
    1. 子进程启动 litellm proxy_cli（端口 4001，避免与常用 4000 冲突）
    2. 轮询 /health/liveliness 直到就绪（超时 120s）
    3. 用无效 key 请求 /v1/chat/completions
    4. 断言错误消息已被中间件翻译为中文（本地无 Postgres 时认证会先报
       no_db_connection，同样是 4xx + 中文，翻译链路等价可验证）
"""

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

# Windows 控制台默认 GBK，输出中文/符号前先切到 UTF-8
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "127.0.0.1"
PORT = 4001
BASE = f"http://{HOST}:{PORT}"
READY_TIMEOUT_S = 120

_NO_PROXY_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def start_proxy() -> subprocess.Popen:
    """以子进程启动代理，输出直接透传到当前终端便于排障。"""
    cmd = [
        sys.executable,
        "-m",
        "litellm.proxy.proxy_cli",
        "--model",
        "gpt-4o",
        "--port",
        str(PORT),
        "--host",
        HOST,
        "--detailed_debug",
    ]
    env = dict(os.environ, LITELLM_MASTER_KEY="sk-test-e2e")
    return subprocess.Popen(cmd, env=env)


def wait_ready() -> bool:
    deadline = time.time() + READY_TIMEOUT_S
    while time.time() < deadline:
        try:
            with _NO_PROXY_OPENER.open(f"{BASE}/health/liveliness", timeout=3) as r:
                if r.status == 200:
                    return True
        except urllib.error.HTTPError:
            return True  # 服务已应答，只是探活路径异常
        except OSError:
            time.sleep(2)
    return False


def call_with_invalid_key() -> tuple[int, dict | None]:
    req = urllib.request.Request(
        f"{BASE}/v1/chat/completions",
        data=b'{"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]}',
        headers={"Content-Type": "application/json", "Authorization": "Bearer invalid-key-123"},
        method="POST",
    )
    try:
        with _NO_PROXY_OPENER.open(req, timeout=30) as r:
            return r.status, json_load(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json_load(e.read())


def json_load(raw: bytes) -> dict | None:
    import json

    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return None


def main() -> int:
    print("=== REQ-03 端到端测试 ===")
    proc = start_proxy()
    try:
        if not wait_ready():
            print(f"✗ 代理在 {READY_TIMEOUT_S}s 内未就绪（端口 {PORT}）")
            return 2
        print("代理已就绪，发送无效 key 请求...")

        status, body = call_with_invalid_key()
        print(f"状态码：{status}")
        print(f"响应内容：{body}")

        if status >= 500 or status < 400:
            print(f"[失败] 未收到 4xx 错误，实际 {status}")
            return 1
        message = (body or {}).get("error", {}).get("message", "")
        if not message:
            print("[失败] 响应中没有 error.message")
            return 1
        if any("一" <= ch <= "鿿" for ch in message):
            print(f"[通过] 错误消息已翻译为中文：{message}")
            return 0
        print(f"[失败] 错误消息仍是英文：{message}")
        return 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())

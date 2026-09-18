"""最终验收：确认 32768 上下文生效 + 显存安全"""
import json, time, paramiko, urllib.request

HOST, USER, PWD = "192.168.100.123", "hifen37", "123456"


def run(cli, cmd, timeout=120):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    stdout.channel.recv_exit_status()
    return out


cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(HOST, username=USER, password=PWD, timeout=20)

print("=== llama-server 启动参数（看 -c 是否 32768）===")
out = run(cli, "ps aux | grep llama-server | grep -v grep")
for seg in out.split():
    if seg.startswith("-c") or seg.startswith("-np") or seg.startswith("--context"):
        print(" ", seg)
print(" ", out[out.find("--model"):][:80] if "--model" in out else "")

print("\n=== ollama ps ===")
print(run(cli, "ollama ps"))

print("\n=== 显存 ===")
print(run(cli, "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader"))

# 触发一次请求，看加载后的表现
print("\n=== 触发一次 Claude Code 式请求 ===")
print(run(cli, """curl -s -m 120 -X POST http://127.0.0.1:4000/v1/messages \
 -H "Content-Type: application/json" \
 -H "x-api-key: sk-M2xHWn5eE1cpymYXZDnFxg" \
 -H "anthropic-version: 2023-06-01" \
 -d '{"model":"qwen3-8b","max_tokens":300,"messages":[{"role":"user","content":"帮我写一个 Python 函数计算斐波那契第 n 项，用迭代实现"}]}' \
 -w "\\n[%{http_code}] %{time_total}s\\n" """))

time.sleep(2)
print("\n=== 请求后显存 ===")
print(run(cli, "nvidia-smi --query-gpu=memory.used --format=csv,noheader"))
cli.close()

#!/usr/bin/env bash
# 端到端验证：OpenAI 端点 / Anthropic 端点 / 工具调用 / 并发
# 用法: GW=http://192.168.100.123:4000 KEY=sk-xxx bash test-e2e.sh
GW=${GW:-http://127.0.0.1:4000}
KEY=${KEY:?需要设置 KEY 环境变量}
M=${M:-qwen3-8b}

pass(){ printf "\033[32m[PASS]\033[0m %s\n" "$1"; }
fail(){ printf "\033[31m[FAIL]\033[0m %s\n" "$1"; }

echo "网关: $GW   模型: $M"
echo

echo "=== 1 健康检查 ==="
C=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$GW/health/liveliness")
[ "$C" = "200" ] && pass "health $C" || fail "health $C"

echo
echo "=== 2 可见模型 ==="
curl -s -m 10 -H "Authorization: Bearer $KEY" "$GW/v1/models"

echo
echo
echo "=== 3 OpenAI 端点 · 普通对话（关思考）==="
curl -s -m 90 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"$M\",\"max_tokens\":100,\"reasoning_effort\":\"none\",\"messages\":[{\"role\":\"user\",\"content\":\"用一句话介绍你自己\"}]}" \
  -w "\n[%{http_code}] %{time_total}s\n"

echo
echo "=== 4 OpenAI 端点 · 工具调用 ==="
curl -s -m 120 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"$M\",\"max_tokens\":300,\"reasoning_effort\":\"none\",\"messages\":[{\"role\":\"user\",\"content\":\"当前目录下有哪些文件？用 list_files 工具查一下\"}],\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"list_files\",\"description\":\"列出指定目录下的文件\",\"parameters\":{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\",\"description\":\"目录路径\"}},\"required\":[\"path\"]}}}]}" \
  -w "\n[%{http_code}] %{time_total}s\n"

echo
echo "=== 5 Anthropic 端点 /v1/messages ==="
curl -s -m 120 -X POST "$GW/v1/messages" \
  -H "Content-Type: application/json" -H "x-api-key: $KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d "{\"model\":\"$M\",\"max_tokens\":100,\"messages\":[{\"role\":\"user\",\"content\":\"Say hi in one sentence\"}]}" \
  -w "\n[%{http_code}] %{time_total}s\n"

echo
echo "=== 6 并发测试（4 路同时）==="
for i in 1 2 3 4; do
  ( curl -s -m 120 -X POST "$GW/v1/chat/completions" \
      -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
      -d "{\"model\":\"$M\",\"max_tokens\":40,\"reasoning_effort\":\"none\",\"messages\":[{\"role\":\"user\",\"content\":\"$i+1=?\"}]}" \
      -o /dev/null -w "  请求$i: %{http_code} %{time_total}s\n" ) &
done
wait

echo
echo "=== 7 流式输出 ==="
curl -s -m 90 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"$M\",\"max_tokens\":60,\"reasoning_effort\":\"none\",\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"数到10\"}]}" \
  -w "\n[%{http_code}] %{time_total}s\n" | head -c 500

echo
echo "=== 完成 ==="

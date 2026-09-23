#!/usr/bin/env bash
# REQ-05 spend 实测：建虚拟密钥 -> 发真实请求 -> 等 Redis 落库 -> 查 /key/info
# 用法（本机）：scp 后在服务器执行，见 dev-plans/13 记录
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4001}"
ENV_FILE="${ENV_FILE:-$HOME/litellm-src/.env}"

KEY=$(grep '^LITELLM_MASTER_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
[ -n "$KEY" ] || { echo "未找到 LITELLM_MASTER_KEY"; exit 1; }

echo "== 1/4 建虚拟密钥（1h 有效）=="
RESP=$(curl -s "$BASE_URL/key/generate" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"models":["qwen3-8b"],"duration":"1h"}')
echo "$RESP" | head -c 300
echo
VK=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["key"])')
echo "虚拟密钥: ${VK:0:12}..."

echo "== 2/4 发真实请求（qwen3-8b 短请求）=="
CHAT=$(curl -s "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $VK" -H "Content-Type: application/json" \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"用一个词回答：1+1等于几"}],"max_tokens":8}')
echo "$CHAT" | head -c 800
echo
echo "$CHAT" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("usage:",d.get("usage",{}))' || true

echo "== 3/4 等 15 秒让 spend 经 Redis 异步落库 =="
sleep 15

echo "== 4/4 查 /key/info 核验 spend =="
curl -s "$BASE_URL/key/info?key=$VK" -H "Authorization: Bearer $KEY" | python3 -m json.tool | head -40

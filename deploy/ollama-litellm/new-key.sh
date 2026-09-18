#!/usr/bin/env bash
# 给同事发一把虚拟 API key
#
# 用法:
#   bash new-key.sh <用户标识> [预算] [有效期] [并发上限] [模型列表(逗号分隔)]
#
# 示例:
#   bash new-key.sh zhangsan                       # 预算 100，30 天，并发 2，全部模型
#   bash new-key.sh lisi 50 7d 1 qwen3-8b          # 预算 50，7 天，并发 1，只允许 8b
#
# 注意：本地模型没有真实花费，max_budget 是内部配额单位，用于防止滥用

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

[ -f .env ] || { echo "缺少 .env，请先运行 deploy-gateway.sh"; exit 1; }
set -a; . ./.env; set +a

USER_NAME="${1:-}"
[ -z "$USER_NAME" ] && { echo "用法: bash new-key.sh <用户标识> [预算] [有效期] [并发上限] [模型]"; exit 1; }

BUDGET="${2:-100}"
DURATION="${3:-30d}"
PARALLEL="${4:-2}"
# 逗号分隔转 JSON 数组；留空则允许网关上全部模型
MODELS_CSV="${5:-qwen3-8b,qwen3.5}"
MODELS_JSON=$(echo "$MODELS_CSV" | awk -F, '{
  printf "[";
  for (i=1;i<=NF;i++) { gsub(/^[ \t]+|[ \t]+$/,"",$i); if (i>1) printf ","; printf "\"%s\"", $i }
  printf "]"}')

HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

RESP=$(curl -s -m 30 -X POST http://127.0.0.1:4000/key/generate \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
        \"key_alias\": \"${USER_NAME}\",
        \"models\": ${MODELS_JSON},
        \"max_budget\": ${BUDGET},
        \"budget_duration\": \"${DURATION}\",
        \"max_parallel_requests\": ${PARALLEL},
        \"metadata\": {\"owner\": \"${USER_NAME}\"}
      }")

VKEY=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('key',''))" 2>/dev/null)

if [ -z "$VKEY" ]; then
  echo "创建失败，返回内容："
  echo "$RESP" | head -c 600; echo
  exit 1
fi

FIRST_MODEL=$(echo "$MODELS_CSV" | cut -d, -f1 | tr -d ' ')

cat <<EOF

================ 已生成 ================

持有者    ${USER_NAME}
预算      ${BUDGET} / ${DURATION}
并发上限  ${PARALLEL}
可用模型  ${MODELS_CSV}

API Key
    ${VKEY}

对方接入方式（Python）
    from openai import OpenAI
    client = OpenAI(base_url="http://${HOST_IP}:4000/v1", api_key="${VKEY}")
    r = client.chat.completions.create(model="${FIRST_MODEL}",
        messages=[{"role": "user", "content": "你好"}])
    print(r.choices[0].message.content)

curl 验证
    curl http://${HOST_IP}:4000/v1/chat/completions \\
      -H "Authorization: Bearer ${VKEY}" \\
      -H "Content-Type: application/json" \\
      -d '{"model":"${FIRST_MODEL}","messages":[{"role":"user","content":"你好"}]}'

========================================
EOF

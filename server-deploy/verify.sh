#!/usr/bin/env bash
# 二开版部署验证：健康、模型、中文错误、真实调用、用量
# 用法：bash verify.sh [端口，默认 4001]
set -uo pipefail

PORT="${1:-4001}"
BASE_URL="http://127.0.0.1:${PORT}"
BASE="${BASE:-$HOME/litellm-cn}"
CONTAINER="${CONTAINER:-litellm-cn}"

PASS=0
FAIL=0

ok()   { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
info() { echo "        $1"; }

KEY=""
if [ -f "$BASE/.env" ]; then
  KEY=$(grep '^LITELLM_MASTER_KEY=' "$BASE/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
fi
[ -z "$KEY" ] && KEY="${LITELLM_MASTER_KEY:-}"

echo "=========================================================="
echo " LiteLLM 二开版验证  端口 ${PORT}"
echo "=========================================================="

echo; echo "[1] 容器状态"
if docker ps --format '{{.Names}} {{.Status}}' | grep -q "^${CONTAINER} "; then
  ok "容器运行中：$(docker ps --format '{{.Status}}' --filter "name=^/${CONTAINER}$")"
else
  bad "容器 ${CONTAINER} 未运行"
fi

echo; echo "[2] 存活探针 /health/liveliness"
resp=$(curl -s -m 10 "$BASE_URL/health/liveliness")
[ "$resp" = "\"I'm alive!\"" ] && ok "$resp" || bad "返回：$resp"

echo; echo "[3] 就绪探针 /health/readiness"
resp=$(curl -s -m 10 "$BASE_URL/health/readiness")
echo "$resp" | grep -q '"db":"connected"' && ok "$resp" || bad "$resp"

echo; echo "[4] litellm_cn 是否可导入（中文错误中间件的前提）"
if docker exec "$CONTAINER" python -c "import litellm_cn; print('ok')" 2>/dev/null | grep -q '^ok$'; then
  ok "litellm_cn 已挂载并可导入"
else
  bad "litellm_cn 导入失败 —— 检查 compose 里 ./litellm_cn 的挂载"
fi

echo; echo "[5] fork 源码是否真的覆盖（版本号应为 1.102.0）"
ver=$(docker exec "$CONTAINER" python -c "import litellm; print(litellm.version if hasattr(litellm,'version') else 'n/a')" 2>/dev/null | tail -1)
info "容器内 litellm 版本：$ver"

echo; echo "[6] 中文错误翻译（二开核心验证）"
if [ -n "$KEY" ]; then
  resp=$(curl -s -m 10 "$BASE_URL/v1/models" -H "Authorization: Bearer sk-this-is-wrong")
  if echo "$resp" | grep -q '认证失败'; then
    ok "错误已中文化：$(echo "$resp" | head -c 120)"
  else
    bad "错误仍是英文（中间件未生效）：$(echo "$resp" | head -c 160)"
  fi
else
  bad "拿不到 LITELLM_MASTER_KEY，跳过"
fi

echo; echo "[7] 模型列表 /v1/models"
if [ -n "$KEY" ]; then
  resp=$(curl -s -m 10 "$BASE_URL/v1/models" -H "Authorization: Bearer $KEY")
  cnt=$(echo "$resp" | grep -o '"id":' | wc -l)
  [ "$cnt" -gt 0 ] && ok "已注册 ${cnt} 个模型" || bad "无模型：$(echo "$resp" | head -c 160)"
  echo "$resp" | grep -o '"id":"[^"]*"' | head -10 | sed 's/^/        /'
else
  bad "无 key，跳过"
fi

echo; echo "[8] 真实调用（走宿主机 Ollama）"
if [ -n "$KEY" ]; then
  resp=$(curl -s -m 180 "$BASE_URL/v1/chat/completions" \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d '{"model":"qwen38-27b-fast","messages":[{"role":"user","content":"只用一句话回答：1+1等于几"}],"max_tokens":64}')
  if echo "$resp" | grep -q '"choices"'; then
    ok "调用成功"
    info "回复：$(echo "$resp" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["choices"][0]["message"]["content"][:80])' 2>/dev/null)"
    info "usage：$(echo "$resp" | python3 -c 'import sys,json;print(json.load(sys.stdin)["usage"])' 2>/dev/null)"
  else
    bad "调用失败：$(echo "$resp" | head -c 300)"
  fi
else
  bad "无 key，跳过"
fi

echo; echo "[9] token 计费（spend 应等于累计 token 数）"
if [ -n "$KEY" ]; then
  resp=$(curl -s -m 15 "$BASE_URL/key/info" -H "Authorization: Bearer $KEY")
  spend=$(echo "$resp" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("info",{}).get("spend","n/a"))' 2>/dev/null)
  info "spend = $spend"
  case "$spend" in
    n/a|0|0.0) bad "spend 为 0 或读不到 —— 检查配置的 input_cost_per_token 是否为 1.0" ;;
    *) ok "spend 有值，token 计费生效" ;;
  esac
else
  bad "无 key，跳过"
fi

echo; echo "[10] 控制台 /ui/"
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE_URL/ui/")
[ "$code" = "200" ] && ok "/ui/ 返回 200（注意：当前仍是上游英文界面）" || bad "/ui/ 返回 $code"

echo; echo "=========================================================="
echo " 通过 ${PASS} 项，失败 ${FAIL} 项"
echo "=========================================================="
echo
echo "常用命令："
echo "  docker compose -p litellm-cn logs -f litellm-cn      # 看日志"
echo "  docker compose -p litellm-cn restart litellm-cn     # 改完源码重启生效"
echo "  curl -s $BASE_URL/health/readiness/details -H 'Authorization: Bearer \$KEY'"
echo
[ "$FAIL" -eq 0 ] || exit 1

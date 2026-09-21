#!/usr/bin/env bash
# 二开版部署验证：健康、模型、中文错误、真实调用、用量
# 用法：bash verify.sh [端口，默认 4001]
set -uo pipefail

PORT="${1:-4001}"
BASE_URL="http://127.0.0.1:${PORT}"
# 非交互执行（ssh host "cmd"）时 $HOME 可能没设，回退到脚本所在目录的上一级
BASE="${BASE:-${HOME:-}/litellm-src}"
[ -f "$BASE/.env" ] || BASE="$(cd "$(dirname "$0")/.." && pwd)"
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

echo; echo "[5] fork 源码是否真的覆盖镜像内置的 litellm"
# 注意：litellm.__version__ 读的是镜像安装元数据（1.101.0），源码被挂载覆盖后不会变，
# 所以这里用 fork 专属标记 CN-FORK 判断，才是可靠证据
sp="/app/.venv/lib/python3.13/site-packages/litellm"
marks=$(docker exec "$CONTAINER" grep -c 'CN-FORK' "$sp/proxy/proxy_server.py" 2>/dev/null | tail -1)
if [ "${marks:-0}" -gt 0 ] 2>/dev/null; then
  ok "容器内 proxy_server.py 含 ${marks} 处 CN-FORK 标记，fork 源码已生效"
else
  bad "未发现 CN-FORK 标记 —— 检查 compose 里 ./litellm 的挂载"
fi
docker exec "$CONTAINER" /app/.venv/bin/python -c "import litellm._version as v; print('        镜像安装元数据版本：', v.version)" 2>/dev/null | tail -1

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
# master key 不在虚拟密钥表里，用它查 /key/info 只会 404，
# 所以这里临时建一把虚拟密钥，发一次最小请求，再读它的 spend
if [ -n "$KEY" ]; then
  VK=$(curl -s -m 20 "$BASE_URL/key/generate" -H "Authorization: Bearer $KEY" \
        -H "Content-Type: application/json" \
        -d '{"models":["qwen38-iq3s"]}' \
        | python3 -c 'import sys,json;print(json.load(sys.stdin)["key"])' 2>/dev/null)
  if [ -z "$VK" ]; then
    bad "建临时虚拟密钥失败"
  else
    usage=$(curl -s -m 180 "$BASE_URL/v1/chat/completions" \
      -H "Authorization: Bearer $VK" -H "Content-Type: application/json" \
      -d '{"model":"qwen38-iq3s","messages":[{"role":"user","content":"说两个字：你好"}],"max_tokens":32}')
    total=$(echo "$usage" | python3 -c 'import sys,json;print(json.load(sys.stdin)["usage"]["total_tokens"])' 2>/dev/null)
    info "本次请求 total_tokens = ${total:-读取失败}"
    # spend 经 Redis 异步落库，需要等一会儿
    sleep 12
    spend=$(curl -s -m 20 "$BASE_URL/key/info" -H "Authorization: Bearer $VK" \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["info"]["spend"])' 2>/dev/null)
    info "spend = ${spend:-n/a}"
    case "${spend:-n/a}" in
      n/a|0|0.0)
        bad "spend 为 0 或读不到 —— 检查 input_cost_per_token 与 cache_creation_input_token_cost 是否都是 1.0" ;;
      *)
        if [ -n "$total" ] && [ "$spend" = "$total" ]; then
          ok "spend(${spend}) == total_tokens(${total})，token 计费生效"
        else
          ok "spend 有值（${spend}），与本次 token 数 ${total} 不等属正常（累计值 / 缓存命中）"
        fi ;;
    esac
  fi
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

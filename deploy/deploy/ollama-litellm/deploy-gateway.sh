#!/usr/bin/env bash
# 部署 LiteLLM 网关（自动选择容器 / 原生 pip 两条路）
# 前置: Ollama 已在宿主机跑通
# 用法: bash deploy-gateway.sh
# 可重复执行

set -uo pipefail

CFG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}  [OK]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}  [!!]${NC} %s\n" "$1"; }
err()  { printf "${RED}  [XX]${NC} %s\n" "$1"; }
step() { printf "\n${BOLD}== %s ==${NC}\n" "$1"; }
die()  { err "$1"; exit 1; }

step "1/6 检查 Ollama"
curl -s -m 5 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 \
  || die "Ollama 未响应，先确认 systemctl status ollama"
ok "Ollama 可达"
ollama list 2>/dev/null | sed 's/^/      /'

step "2/6 生成密钥"
cd "$CFG_DIR" || exit 1
if [ -f .env ]; then
  warn ".env 已存在，保留原有密钥（如需重置请先删除该文件）"
else
  MASTER_KEY="sk-$(openssl rand -hex 24)"
  PG_PASSWORD="$(openssl rand -hex 16)"
  cat > .env <<EOF
LITELLM_MASTER_KEY=${MASTER_KEY}
PG_PASSWORD=${PG_PASSWORD}
EOF
  chmod 600 .env
  ok "已生成 .env（master key 与数据库密码，权限 600）"
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

step "3/6 拉取基础镜像（Postgres / Redis）"
mkdir -p data/postgres data/redis
docker compose up -d db redis 2>&1 | tail -3 \
  || warn "拉取或启动失败，稍后可能需要改用 apt 安装"
sleep 5
docker compose ps db redis 2>/dev/null | sed 's/^/      /'

step "4/6 拉取 LiteLLM 镜像（ghcr.io，最多等 5 分钟）"
# registry-mirrors 对 ghcr.io 无效，这里纯粹看直连速度
if timeout 300 docker pull ghcr.io/berriai/litellm:main-stable >/dev/null 2>&1; then
  MODE="container"
  ok "镜像拉取成功，走容器方案"
else
  MODE="native"
  warn "ghcr.io 拉不动或超时，改用宿主机 pip 方案"
fi

if [ "$MODE" = "container" ]; then
  step "5/6 启动网关容器"
  OLLAMA_API_BASE="http://host.docker.internal:11434" docker compose up -d litellm 2>&1 | tail -3
  FOLLOW_LOG='docker compose logs -f litellm'
else
  step "5/6 安装 LiteLLM（pip + systemd）"
  if [ ! -x "${HOME}/litellm-venv/bin/litellm" ]; then
    sudo apt-get install -y -qq python3-pip python3-venv 2>&1 | tail -2
    python3 -m venv "${HOME}/litellm-venv" || die "创建虚拟环境失败"
    echo "  安装 litellm（走清华源，需几分钟）："
    "${HOME}/litellm-venv/bin/pip" install -q -i https://pypi.tuna.tsinghua.edu.cn/simple 'litellm[proxy]' \
      || die "pip 安装失败"
  fi
  ok "litellm 已安装"

  sudo tee /etc/systemd/system/litellm.service >/dev/null <<EOF
[Unit]
Description=LiteLLM Proxy
After=network.target ollama.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${CFG_DIR}
Environment="LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}"
Environment="DATABASE_URL=postgresql://llmproxy:${PG_PASSWORD}@127.0.0.1:5432/litellm"
Environment="REDIS_HOST=127.0.0.1"
Environment="REDIS_PORT=6379"
Environment="OLLAMA_API_BASE=http://127.0.0.1:11434"
ExecStart=${HOME}/litellm-venv/bin/litellm --config ${CFG_DIR}/litellm_config.yaml --port 4000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now litellm >/dev/null 2>&1
  sleep 5
  systemctl is-active --quiet litellm || warn "服务未运行，查看: sudo journalctl -u litellm -n 50"
  FOLLOW_LOG='sudo journalctl -u litellm -f'
fi

step "6/6 等待网关就绪"
# 首次启动要跑 Prisma 迁移（建几十张表），2 分钟常常不够，给 5 分钟
printf "  首次启动需跑数据库迁移，最多等 5 分钟\n  轮询 /health/liveliness"
READY=0
for i in $(seq 1 150); do
  if curl -sf -m 3 http://127.0.0.1:4000/health/liveliness >/dev/null 2>&1; then echo; ok "网关已就绪"; READY=1; break; fi
  printf "."; sleep 2
done
if [ "$READY" -eq 0 ]; then
  echo
  err "网关未就绪，最近日志如下："
  if [ "$MODE" = "container" ]; then
    docker compose logs litellm --tail 40 2>/dev/null | sed 's/^/    /'
  else
    sudo journalctl -u litellm -n 40 --no-pager 2>/dev/null | sed 's/^/    /'
  fi
  echo
  echo "  持续观察: ${FOLLOW_LOG}"
  echo "  容器状态: docker compose ps -a"
  exit 1
fi

echo "  模型列表："
curl -s -m 10 http://127.0.0.1:4000/model/list 2>/dev/null | head -c 300; echo

echo
echo "  发一把虚拟 key 用于测试："
KEY_JSON=$(curl -s -m 20 -X POST http://127.0.0.1:4000/key/generate \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"models":["qwen3-8b","qwen3-embed"],"max_budget":100,"budget_duration":"30d","metadata":{"purpose":"smoke-test"}}')
VIRTUAL_KEY=$(echo "$KEY_JSON" | grep -o '"key":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$VIRTUAL_KEY" ]; then
  echo "    ${VIRTUAL_KEY}"

  echo
  echo "  用这把 key 调一次模型："
  curl -s -m 120 -X POST http://127.0.0.1:4000/v1/chat/completions \
    -H "Authorization: Bearer ${VIRTUAL_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"用一句话介绍你自己"}]}' \
    | head -c 600; echo
else
  warn "创建 key 失败，返回内容："
  echo "$KEY_JSON" | head -c 400; echo
fi

cat <<TXT

================ 网关就绪 ================

管理地址      http://<本机IP>:4000/ui
master key    ${LITELLM_MASTER_KEY}   (保存在 ${CFG_DIR}/.env)

内部同事接入方式（换成自己的 key）：
  from openai import OpenAI
  client = OpenAI(base_url="http://<本机IP>:4000/v1", api_key="<发给他的key>")

常用命令
  看日志           ${FOLLOW_LOG}
  重启网关         ${MODE}: $( [ "$MODE" = container ] && echo 'docker compose restart litellm' || echo 'sudo systemctl restart litellm' )
  发 key           curl -X POST http://127.0.0.1:4000/key/generate -H "Authorization: Bearer \${LITELLM_MASTER_KEY}" -H "Content-Type: application/json" -d '{"models":["qwen3-8b"],"max_budget":50}'
  查看花费         curl -s http://127.0.0.1:4000/global/spend/report -H "Authorization: Bearer \${LITELLM_MASTER_KEY}"

注意
  - 同事只能通过 4000 端口访问，Ollama 的 11434 和数据库的 5432 都只监听本机，请勿对外暴露
  - 首次访问 /ui 用上面的 master key 登录
TXT

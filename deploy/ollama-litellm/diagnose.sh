#!/usr/bin/env bash
# 一次性诊断：Ollama 状态 + 防火墙 + 容器到宿主机的连通性 + 网关日志
# 用法: bash diagnose.sh

G=; Y=; R=; N=
if [ -t 1 ]; then
  G='\033[32m'; Y='\033[33m'; R='\033[31m'; N='\033[0m'
fi
sec(){ printf "\n${G}===== %s =====${N}\n" "$1"; }
ok(){ printf "${G}[OK]${N} %s\n" "$1"; }
warn(){ printf "${Y}[!!]${N} %s\n" "$1"; }
bad(){ printf "${R}[XX]${N} %s\n" "$1"; }

sec "1/7  Ollama 服务"
systemctl is-active --quiet ollama && ok "服务运行中" || bad "服务未运行"
ollama --version 2>&1 | head -1
echo -n "监听地址: "
ss -tlnp 2>/dev/null | grep 11434 | awk '{print $4}' | head -1

sec "2/7  已安装模型"
ollama list

sec "3/7  本机推理测试（8b，最多 90 秒）"
START=$(date +%s)
R1=$(curl -s -m 90 -X POST http://127.0.0.1:11434/api/chat \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"用一句话介绍你自己"}],"stream":false,"options":{"num_ctx":8192}}' 2>&1)
COST=$(( $(date +%s) - START ))
if echo "$R1" | grep -q '"content"'; then
  ok "8b 推理正常（耗时 ${COST}s）"
  echo "$R1" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  回复:',d['message']['content'][:120])" 2>/dev/null \
    || echo "$R1" | head -c 200
else
  bad "8b 推理失败（耗时 ${COST}s）："
  echo "$R1" | head -c 300; echo
fi

sec "4/7  显存与常驻模型"
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader 2>/dev/null
ollama ps

sec "5/7  防火墙规则（关键）"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw status 2>/dev/null | grep -E '11434|4000|Status' || echo "  无相关规则"
  echo
  if sudo ufw status 2>/dev/null | grep -qE '11434.*DENY|DENY.*11434'; then
    warn "11434 被 DENY —— 这可能同时挡住了 Docker 容器访问 Ollama，是网关起不来的常见原因"
  fi
else
  echo "  未安装 ufw"
fi
echo -n "docker0 网桥地址: "
ip -4 addr show docker0 2>/dev/null | grep inet | awk '{print $2}' || echo "无"

sec "6/7  容器能否访问宿主机 Ollama（最关键）"
BR=$(ip -4 addr show docker0 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1)
echo "  网桥 IP: ${BR:-未获取到}"
for U in "http://${BR}:11434" "http://host.docker.internal:11434" "http://172.17.0.1:11434"; do
  echo -n "  容器内访问 $U -> "
  if docker run --rm --add-host=host.docker.internal:host-gateway \
       ghcr.io/berriai/litellm:main-stable \
       python3 -c "import urllib.request,sys;sys.stdout.write(str(urllib.request.urlopen('$U/api/tags',timeout=8).status))" 2>/dev/null; then
    echo "  ✔ 通"
  else
    echo "  ✘ 不通"
  fi
done

sec "7/7  网关容器状态与日志尾部"
docker compose ps 2>/dev/null | head -6
echo "--- 日志最后 6 行 ---"
docker compose logs litellm 2>&1 | tail -6
echo
if docker compose logs litellm 2>&1 | grep -q "Uvicorn running"; then
  ok "已出现 Uvicorn running，服务应已监听"
else
  warn "未出现 Uvicorn running —— 启动未完成，多半卡在访问 Ollama 或 Redis"
fi

sec "诊断结束"
echo "请把以上全部输出发给协助你的人。"

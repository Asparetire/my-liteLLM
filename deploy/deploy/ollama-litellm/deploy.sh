#!/usr/bin/env bash
# Ollama 原生部署（修复 + 启动 + 拉模型 + 验证 GPU）
# 针对: RTX 5060 Ti 16GB, Ubuntu, Ollama 已解压到 /usr/local
# 可重复执行，已完成的步骤自动跳过
# 用法: bash deploy.sh

set -uo pipefail

GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}  [OK]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}  [!!]${NC} %s\n" "$1"; }
err()  { printf "${RED}  [XX]${NC} %s\n" "$1"; }
step() { printf "\n${BOLD}== %s ==${NC}\n" "$1"; }
die()  { err "$1"; exit 1; }

[ -x /usr/local/bin/ollama ] || die "找不到 /usr/local/bin/ollama，先完成解压安装"

step "1/7 检查二进制与驱动"
ok "Ollama $(/usr/local/bin/ollama --version 2>&1 | grep -o '[0-9.]*' | head -1)"

# 主程序必须与推理引擎成对存在。缺 llama-server 时 serve 会报
# "error starting llama-server: llama-server binary not found"
if [ -x /usr/local/lib/ollama/llama-server ]; then
  ok "推理引擎 llama-server 就位"
else
  err "缺少 /usr/local/lib/ollama/llama-server（解压不完整）"
  LS_PATH=$(find /usr/local /tmp /opt -name llama-server -type f 2>/dev/null | head -1)
  if [ -n "$LS_PATH" ]; then
    echo "  在别处找到: $LS_PATH"
    sudo mkdir -p /usr/local/lib/ollama
    sudo cp "$LS_PATH" /usr/local/lib/ollama/llama-server
    sudo chmod +x /usr/local/lib/ollama/llama-server
    ok "已复制到 /usr/local/lib/ollama/"
  else
    cat <<'TXT'
  需要重新解压安装包，执行：

    sudo tar -I zstd -xvf /tmp/ollama.tar.zst -C /usr/local

  安装包若已丢失，先重新下载（aria2 断点续传，可重复执行）：
    aria2c -c -x 16 -s 16 -d /tmp -o ollama.tar.zst \
      https://ollama.com/download/ollama-linux-amd64.tar.zst
TXT
    exit 1
  fi
fi
command -v nvidia-smi >/dev/null 2>&1 || die "未检测到 nvidia-smi"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | sed 's/^/      /'

step "2/7 运行用户与模型目录"
if id ollama >/dev/null 2>&1; then
  ok "用户 ollama 已存在"
else
  sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama && ok "已创建用户 ollama" \
    || die "创建用户失败"
fi
sudo mkdir -p /usr/share/ollama/.ollama
sudo chown -R ollama:ollama /usr/share/ollama
ok "模型目录 /usr/share/ollama/.ollama 权限已修正"

step "3/7 写入 systemd 服务"
sudo tee /etc/systemd/system/ollama.service >/dev/null <<'EOF'
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_FLASH_ATTENTION=1"

[Install]
WantedBy=default.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable ollama >/dev/null 2>&1
ok "服务文件已写入并设为开机自启"

step "4/7 启动服务"
sudo systemctl restart ollama || warn "restart 返回非零，继续检查"
sleep 3
if systemctl is-active --quiet ollama; then
  ok "服务运行中"
else
  err "服务未启动，日志如下："
  sudo journalctl -u ollama -n 30 --no-pager | sed 's/^/    /'
  echo
  echo "  再试一次前台运行以查看实时报错（Ctrl+C 退出）："
  echo "    sudo -u ollama OLLAMA_HOST=0.0.0.0:11434 /usr/local/bin/ollama serve"
  exit 1
fi

step "5/7 验证 API"
printf "  等待 11434 端口"
for i in $(seq 1 20); do
  curl -s -m 2 http://localhost:11434/api/tags >/dev/null 2>&1 && { echo; ok "API 已响应"; break; }
  printf "."; sleep 1
  [ "$i" -eq 20 ] && { echo; die "20 秒无响应，检查 journalctl -u ollama"; }
done
curl -s http://localhost:11434/api/tags | head -c 200; echo

step "6/7 拉取 qwen3:8b 并验证 GPU"
if ollama list 2>/dev/null | grep -q "qwen3:8b"; then
  ok "qwen3:8b 已存在，跳过拉取"
else
  echo "  拉取中（约 5.2GB）："
  ollama pull qwen3:8b || die "拉取失败，检查网络"
fi

echo "  首次推理，加载模型可能需要 10-30 秒："
ollama run qwen3:8b "用一句话介绍你自己" 2>&1 | sed 's/^/    /'
echo
echo "  显存驻留情况（PROCESSOR 必须是 100% GPU）："
ollama ps 2>&1 | sed 's/^/    /'
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader | sed 's/^/    显存 已用\/总: /'

step "7/7 可选：更大模型"
if [ "${PULL_14B:-0}" = "1" ]; then
  if ollama list 2>/dev/null | grep -q "qwen3:14b"; then
    ok "qwen3:14b 已存在"
  else
    echo "  拉取中（约 9.3GB）："
    ollama pull qwen3:14b || warn "拉取失败"
  fi
else
  echo "  已跳过。当前只用 qwen3:8b，显存占用约 5.2GB，余量充足。"
  echo "  需要更好效果时再拉：ollama pull qwen3:14b"
  echo "  或更高精度的 8b： ollama pull qwen3:8b-q8_0   (约 8.7GB，质量更好)"
fi

cat <<'TXT'

================ 完成 ================

验证清单
  ollama ps                  PROCESSOR 列为 100% GPU 才算成功
  nvidia-smi                 应能看到 ollama 进程占用数 GB 显存
  curl localhost:11434/api/tags

如果 ollama pull 很慢
  用 aria2 先下 GGUF 再导入：
    aria2c -c -x 16 -s 16 "<GGUF 直链>"
    ollama create qwen3:14b -f Modelfile

下一步：部署 LiteLLM 网关
  1. 先测镜像仓库：timeout 60 docker pull ghcr.io/berriai/litellm:main-stable
  2. 拉得动 -> docker compose up -d（配置已改为对接宿主机 Ollama）
  3. 拉不动 -> 走 pip 方案，见 README-原生部署.md 第 2 节
     注意此时要把 litellm_config.yaml 里的 api_base 改成 http://127.0.0.1:11434
TXT

#!/bin/bash
# 让 Ollama 从 hf-mirror.com 而不是 huggingface.co 拉取 HF 模型
# 背景：本机直连 huggingface.co 被拒（dial tcp ...: connection refused），
#       hf-mirror.com 实测 0.27s 可达。
# 用法：sudo bash set-hf-mirror.sh
set -e

D=/etc/systemd/system/ollama.service.d/override.conf
BAK="${D}.bak-hfmirror"

if [ ! -f "$BAK" ]; then
  cp "$D" "$BAK"
  echo "[备份] $BAK"
else
  echo "[备份] 已存在，跳过"
fi

if grep -q 'HF_ENDPOINT' "$D"; then
  echo "[跳过] HF_ENDPOINT 已配置"
else
  printf 'Environment="HF_ENDPOINT=https://hf-mirror.com"\n' >> "$D"
  printf 'Environment="OLLAMA_REQUEST_TIMEOUT=30m"\n' >> "$D"
  echo "[写入] HF_ENDPOINT + OLLAMA_REQUEST_TIMEOUT"
fi

echo "--- override.conf 现状 ---"
cat "$D"

systemctl daemon-reload
systemctl restart ollama
sleep 8

echo "--- 生效的环境变量 ---"
systemctl show ollama -p Environment

echo "--- 服务状态 ---"
systemctl is-active ollama
curl -s -m 5 http://127.0.0.1:11434/ || echo "(curl 失败)"

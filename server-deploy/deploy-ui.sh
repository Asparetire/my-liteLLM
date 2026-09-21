#!/usr/bin/env bash
# 部署汉化 UI：本机构建产物 out/ 上传服务器，启用 compose 挂载并重建容器
# 用法：bash server-deploy/deploy-ui.sh（在仓库根目录执行，需 SSH 免密可达 192.168.100.123）
set -euo pipefail

HOST=hifen37@192.168.100.123
SRC="D:/project/litellm-src/ui/litellm-dashboard/out"

echo "== 1/4 清空服务器 ui_cn =="
ssh "$HOST" "rm -rf ~/litellm-src/ui_cn && mkdir -p ~/litellm-src/ui_cn"

echo "== 2/4 上传构建产物（out/. -> ~/litellm-src/ui_cn/） =="
scp -r "$SRC/." "$HOST:~/litellm-src/ui_cn/"

echo "== 3/4 启用 compose 挂载两行 =="
ssh "$HOST" "cd ~/litellm-src && \
  cp docker-compose.cn.yml docker-compose.cn.yml.bak && \
  sed -i 's|# - ./ui_cn:/app/ui_cn:ro|- ./ui_cn:/app/ui_cn:ro|; s|# LITELLM_UI_PATH: /app/ui_cn|LITELLM_UI_PATH: /app/ui_cn|' docker-compose.cn.yml && \
  grep -n 'ui_cn\|LITELLM_UI_PATH' docker-compose.cn.yml"

echo "== 4/4 重建容器 =="
ssh "$HOST" "cd ~/litellm-src && docker compose -f docker-compose.cn.yml -p litellm-cn up -d"

echo "== 等待 30 秒后验证 =="
sleep 30
curl -s http://192.168.100.123:4001/health/readiness && echo
curl -s http://192.168.100.123:4001/ui/ | head -c 200 && echo
echo "完成：浏览器打开 http://192.168.100.123:4001/ui/ 登录验证（admin / MASTER_KEY）"

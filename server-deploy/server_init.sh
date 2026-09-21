#!/usr/bin/env bash
# 服务器端初始化：建目录、取出 Rust 扩展、生成 .env 模板
# 用法：bash server_init.sh
set -euo pipefail

BASE="${BASE:-$HOME/litellm-src}"
SRC_STACK="${SRC_STACK:-$HOME/ollama-litellm}"
IMAGE="${IMAGE:-ghcr.io/berriai/litellm:main-stable}"
SP="/app/.venv/lib/python3.13/site-packages/litellm"
SO="_native.abi3.so"

echo "==> 目标目录：$BASE"
mkdir -p "$BASE"/{litellm,litellm_cn,rust_bridge,ui_cn,data/postgres,data/redis}

echo "==> 取出 Rust 扩展 $SO"
if [ -s "$BASE/rust_bridge/$SO" ]; then
  echo "    已存在，跳过"
else
  if docker ps --format '{{.Names}}' | grep -qx litellm; then
    docker cp "litellm:$SP/rust_bridge/$SO" "$BASE/rust_bridge/$SO"
  else
    echo "    原版容器 litellm 未运行，改用一次性容器取文件"
    cid=$(docker create "$IMAGE")
    docker cp "$cid:$SP/rust_bridge/$SO" "$BASE/rust_bridge/$SO"
    docker rm "$cid" >/dev/null
  fi
  echo "    已保存：$BASE/rust_bridge/$SO（$(du -h "$BASE/rust_bridge/$SO" | cut -f1)）"
fi

echo "==> 生成 .env"
if [ ! -f "$BASE/.env" ]; then
  : > "$BASE/.env"
  if [ -f "$SRC_STACK/.env" ] && grep -q '^LITELLM_MASTER_KEY=' "$SRC_STACK/.env"; then
    grep '^LITELLM_MASTER_KEY=' "$SRC_STACK/.env" >> "$BASE/.env"
    echo "    已沿用原版 LITELLM_MASTER_KEY（客户端无需换 key）"
  else
    echo "LITELLM_MASTER_KEY=sk-请填写" >> "$BASE/.env"
    echo "    [warn] 没找到原版 master key，请手工填写"
  fi
  cat >> "$BASE/.env" <<'EOF'
PG_PASSWORD=change-me-please
OLLAMA_API_BASE=http://host.docker.internal:11434
EOF
  chmod 600 "$BASE/.env"
  echo "    已生成 $BASE/.env —— 请修改 PG_PASSWORD"
else
  echo "    已存在，跳过"
fi

echo "==> 本地忽略规则（写进 .git/info/exclude，不改仓库的 .gitignore，避免与上游冲突）"
if [ -d "$BASE/.git" ]; then
  EXC="$BASE/.git/info/exclude"
  for pat in "/data/" "/.env" "/.venv/" "/rust_bridge/" "/node_modules/" "/ui_cn/"; do
    grep -qxF "$pat" "$EXC" 2>/dev/null || echo "$pat" >> "$EXC"
  done
  echo "    已写入 $EXC"
else
  echo "    不是 git 仓库，跳过（建议用 git clone 方式放置代码，见 README-VSCode远程开发.md）"
fi

cat <<EOF

初始化完成。接下来（远程开发模式）：

  1) 在 VS Code 里 Remote-SSH 连接本服务器，打开 $BASE
  2) 修改 .env 里的 PG_PASSWORD：
       vi $BASE/.env
  3) 启动二开版：
       cd $BASE && docker compose -f docker-compose.cn.yml -p litellm-cn up -d
       docker compose -p litellm-cn logs -f litellm-cn
  4) 验证：
       bash server-deploy/verify.sh 4001

若代码还没放到服务器上，见 README-VSCode远程开发.md 第 2 节（git 方式搬运，保留提交历史）。
EOF

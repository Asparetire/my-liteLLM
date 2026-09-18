#!/usr/bin/env bash
# 阶段二：在服务器上构建二开版自有镜像
#
# 相对官方 Dockerfile 做三处改造（脚本自动完成，不改仓库里的 Dockerfile）：
#   1. 注入 PyPI 清华源 —— 否则 uv sync 走 files.pythonhosted.org 会慢或超时
#   2. 补 COPY litellm_cn —— 官方 runtime 阶段不带它，中文错误中间件会被静默跳过
#   3. node 基础镜像走 Docker Hub 镜像站 —— 服务器直连 registry-1.docker.io 不通
#
# 用法（在服务器上的源码目录里执行）：
#   cd ~/litellm-cn-src && bash server-deploy/build-image.sh
set -euo pipefail

SRC="${SRC:-$HOME/litellm-cn-src}"
TAG="${TAG:-litellm-cn:1.102.0}"
PYPI_INDEX="${PYPI_INDEX:-https://pypi.tuna.tsinghua.edu.cn/simple}"

cd "$SRC"
[ -f Dockerfile ] || { echo "[error] $SRC 下没有 Dockerfile，先用 sync_fork.py --full-repo 上传整仓"; exit 1; }

echo "==> 生成改造后的 Dockerfile.cn"
python3 - "$PYPI_INDEX" <<'PY'
import re
import sys

index = sys.argv[1]
src = open("Dockerfile", encoding="utf-8").read()

# 1) builder 阶段注入镜像源（两处 uv sync 都在 builder 里）
anchor = "FROM $LITELLM_BUILD_IMAGE AS builder"
if anchor not in src:
    sys.exit("[error] 没找到 builder 阶段的 FROM，Dockerfile 结构可能变了")
inject = anchor + f"""

# [CN-FORK] 国内镜像源：uv sync 默认走 files.pythonhosted.org，在本机会超时
ENV UV_DEFAULT_INDEX={index} \\
    UV_HTTP_TIMEOUT=120 \\
    UV_FETCH_RETRIES=5 \\
    PIP_INDEX_URL={index}"""
src = src.replace(anchor, inject, 1)

# 2) runtime 阶段补 litellm_cn，否则中文错误中间件被 except ImportError 静默跳过
anchor2 = "COPY --from=builder /app/litellm-proxy-extras /app/litellm-proxy-extras"
if anchor2 not in src:
    sys.exit("[error] 没找到 litellm-proxy-extras 的 COPY，Dockerfile 结构可能变了")
inject2 = anchor2 + """

# [CN-FORK] 中文错误中间件外挂包。proxy_cli.py 会把 cwd(/app) 加入 sys.path，
# 所以放在 /app 下即可被 import，无需改 PYTHONPATH。
COPY --from=builder /app/litellm_cn /app/litellm_cn"""
src = src.replace(anchor2, inject2, 1)

open("Dockerfile.cn", "w", encoding="utf-8").write(src)
print("    已写入 Dockerfile.cn")
PY

echo "==> 探测可用的 node 基础镜像"
NODE_IMG=""
for cand in \
  "docker.1panel.live/library/node:24.19-alpine3.24" \
  "docker.m.daocloud.io/library/node:24.19-alpine3.24" \
  "hub.rat.dev/library/node:24.19-alpine3.24" \
  "node:24.19-alpine3.24"; do
  echo -n "    尝试 $cand ... "
  if docker pull "$cand" >/dev/null 2>&1; then
    echo "OK"
    NODE_IMG="$cand"
    break
  fi
  echo "失败"
done
[ -n "$NODE_IMG" ] || { echo "[error] 所有候选都拉不到，手工指定后重试"; exit 1; }

echo "==> 开始构建（首次约 30-60 分钟，含 Rust 扩展编译与前端构建）"
echo "    target=runtime  tag=$TAG"
DOCKER_BUILDKIT=1 docker build \
  -f Dockerfile.cn \
  --target runtime \
  --build-arg UI_BUILD_IMAGE="$NODE_IMG" \
  -t "$TAG" \
  .

echo
echo "==> 构建完成：$TAG"
docker images "$TAG"

cat <<EOF

下一步：
  1) 编辑 ~/litellm-cn/docker-compose.cn.yml
       image: $TAG
     并删除三个源码挂载（litellm / litellm_cn / rust_bridge 的 .so）
  2) docker compose -p litellm-cn up -d
  3) bash server-deploy/verify.sh 4001

验证镜像内确实带了中文包：
  docker run --rm --entrypoint sh $TAG -c 'ls /app/litellm_cn'
EOF

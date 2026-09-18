# LiteLLM 二开版部署方案（服务器 192.168.100.123）

> 本方案基于对目标服务器的**实测探查**编写，所有结论均有证据，不是通用模板。
> 探查时间：2026-09-18

## 0. 先选模式：代码放哪

| 模式 | 代码真身 | 适用 | 文档 |
|---|---|---|---|
| **远程开发模式**（推荐） | 服务器 `~/litellm-src`，VS Code Remote-SSH 直连改 | 长期开发，改完重启即生效 | **[README-VSCode远程开发.md](./README-VSCode远程开发.md)** |
| 上传模式 | Windows 本地，用 `sync_fork.py` 上传 | 临时验证、不方便在服务器上开发 | 本文件 |

两种模式跑的是**同一套编排**（`docker-compose.cn.yml`），区别只有代码从哪来。
选远程开发模式就按那份文档走，本文件第 4 节里的「上传」步骤可跳过。

---

## 1. 服务器现状（实测）

| 项 | 实测值 |
|---|---|
| 系统 | Ubuntu 26.04 LTS，内核 7.0.0-31-generic |
| 硬件 | 8 核 / 30 GB 内存 / 1.8 TB 磁盘（已用 72 GB） |
| GPU | NVIDIA GeForce RTX 5060 Ti 16 GB，驱动 595.91.07 |
| Docker | 29.1.3，Compose 2.40.3 |
| 数据盘 | `/dev/nvme0n1p2` 1.7 TB 可用 |

### 1.1 现有原版部署

目录 `/home/hifen37/ollama-litellm/`：`docker-compose.yml` + `litellm_config.yaml` + `.env` + `patches/` + `data/`

| 容器 | 镜像 | 端口 | 状态 |
|---|---|---|---|
| `litellm` | `ghcr.io/berriai/litellm:main-stable`（**litellm 1.101.0**） | `0.0.0.0:4000` | Up 4h (healthy) |
| `litellm_db` | `postgres:16` | `127.0.0.1:5432` | 库 `litellm`，**已有 7 个虚拟密钥** |
| `litellm_redis` | `redis:7` | `127.0.0.1:6379` | Up |

- Ollama 为宿主机原生 systemd 服务，监听 `0.0.0.0:11434`，已装 `qwen38-iq3s`（27.3B，262144 上下文）、`qwen3.8:27b`
- 容器通过 `OLLAMA_API_BASE=http://172.17.0.1:11434` 访问宿主机 Ollama
- 已挂载 `patches/`（`PYTHONPATH=/app/patches`，Ollama 缓存计数补丁）

### 1.2 网络实况（决定方案可行性）

| 目标 | 结果 | 影响 |
|---|---|---|
| `cgr.dev`（Chainguard 基础镜像） | ✅ 307 | 镜像构建可行 |
| `ghcr.io` | ✅ 401（需认证，正常） | 拉官方镜像可行 |
| `registry-1.docker.io` | ❌ 超时 | **Docker Hub 直连不通**，靠 `daemon.json` 里 3 个镜像站 |
| `docker.1panel.live` / `docker.m.daocloud.io` / `hub.rat.dev` | ✅ 200 / 401 / 302 | 镜像站可用，可拉 `node:24` |
| `registry.npmjs.org` | ✅ 200 | 前端构建可行 |
| `pypi.tuna.tsinghua.edu.cn` | ✅ 200 | Python 依赖走清华源 |
| `files.pythonhosted.org` | ✅ 404（根路径，说明可达） | PyPI 官方源也通，但建议仍走清华 |
| `index.crates.io` / `static.crates.io` | ✅ 200 / 403 | Rust 扩展可编译 |
| `pgbouncer.org` | ✅ 200 | Dockerfile 里的 pgbouncer 下载可行 |
| `nodejs.org` / `deb.nodesource.com` | ✅ 200 | 需要时可装 Node |
| `github.com` / `raw.githubusercontent.com` | ❌ 超时 | **LiteLLM 启动时拉价格表必然失败重试**，需设 `LITELLM_LOCAL_MODEL_COST_MAP=True` |

---

## 2. 二开版现状（本地仓库 `D:\project\litellm-src`）

| 项 | 值 |
|---|---|
| 版本 | `1.102.0`（`pyproject.toml`），原版镜像是 `1.101.0`，**仅差一个 patch** |
| 分支 | `develop` |
| 已落地改动 | `litellm/proxy/proxy_server.py:1529` `[CN-FORK]` 挂载点（启动时 `from litellm_cn.middleware import install`）；外挂包 `litellm_cn/`（translator + middleware + locale）；`dev-plans/` 13 份需求文档；`docs/zh-CN/` |
| 待上传体积 | `litellm/` 3534 个文件共 **67.3 MB**；`litellm_cn/` 9 个文件 0.02 MB |

### 2.1 三个必须先知道的坑

**坑 1：官方 Dockerfile 会把 `litellm_cn/` 丢掉。**
`Dockerfile` 的 runtime 阶段只 COPY `.venv / docker / schema.prisma / prisma_migration.py / enterprise / litellm-proxy-extras / opt-prisma`，**不含 `litellm_cn/`**。实测现网镜像里 `/app/litellm_cn` 不存在。而 `proxy_server.py` 的挂载点写的是 `try: import ... except ImportError: pass` —— 静默跳过，不报错。直接按官方 Dockerfile 构建，中文错误中间件**不会生效**，而且你完全看不出来。

**坑 2：镜像里有一个编译好的 Rust 扩展。**
`/app/.venv/lib/python3.13/site-packages/litellm/rust_bridge/_native.abi3.so`（14 MB）。整目录挂载 fork 的 `litellm/` 会把它盖掉。好在 `rust_bridge/configuration.py` 里 `DEFAULT_RUST_ENABLED = False`，缺了它只是 Rust 加速路径不可用，不会崩。但建议把 `.so` 拷出来再挂回去（本方案已处理）。

**坑 3：`litellm_proxy_extras` / `litellm_enterprise` 是独立包，不在 `litellm/` 里。**
镜像内是 0.4.94 / 0.1.65，fork 源码里是 **0.4.97 / 0.1.67**。挂载 `litellm/` 不会更新它们（Prisma 迁移文件也在 extras 里）。这是挂载方案的固有漂移，见第 3 节的取舍。

---

## 3. 方案选型

| 方案 | 做法 | 耗时 | 一致性 | 适用 |
|---|---|---|---|---|
| **A 源码挂载**（阶段一推荐） | 复用现有 main-stable 镜像，挂载 fork 的 `litellm/` + `litellm_cn/`，**端口 4001 + 独立库** | 约 10 分钟 | 有漂移（见坑 3） | 开发期：看效果、改代码秒级生效 |
| **B 构建自有镜像**（阶段二推荐） | 服务器端 `docker build`，产出 `litellm-cn:1.102.0` | 30-60 分钟 | 完全一致 | 定版、上生产 |
| C 宿主机 venv 直跑 | pip/uv 装到系统 | 长 | 差 | ❌ 不推荐：系统 Python 是 3.14.4（过新），且无 node/uv，`prisma generate` 需要 node |

**推荐节奏：先 A 跑起来看效果，定版后走 B 出镜像。现有 4000 全程不动。**

---

## 4. 阶段一：路径 A —— 源码挂载（推荐先做）

### 4.1 隔离原则（重要）

| 资源 | 二开版 | 原版 | 说明 |
|---|---|---|---|
| 端口 | **4001** | 4000 | 全程不冲突 |
| 数据库 | 新容器 `litellm_cn_db`，库 `litellm`，映射 `127.0.0.1:5433` | `litellm_db` 5432 | 完全隔离，`prisma migrate deploy` 不会碰到原版的 7 个密钥 |
| Redis | 新容器 `litellm_cn_redis`，`127.0.0.1:6380` | 6379 | 避免预算/限流键相互干扰 |
| 容器名 | `litellm-cn` | `litellm` | — |
| 项目名 | `litellm-cn` | `ollama-litellm` | compose `-p` 区分 |
| Master Key | 沿用原版同一个 | — | 客户端（Claude Code 等）改端口即可，不用换 key |

### 4.2 步骤

**第 1 步：服务器端建目录并取出 Rust 扩展**

```bash
bash server-deploy/server_init.sh
```

做三件事：建 `~/litellm-src/{litellm,litellm_cn,rust_bridge,data}`；从运行中的 `litellm` 容器 `docker cp` 出 `_native.abi3.so`；生成 `.env` 模板。

**第 2 步：本机上传 fork 源码**

```powershell
$env:LITELLM_SERVER_PWD = "<服务器密码>"
python server-deploy/sync_fork.py --host 192.168.100.123 --user hifen37
```

只传 `litellm/` 与 `litellm_cn/`，排除 `__pycache__` / `*.pyc`，约 67 MB。增量比对 mtime+size，第二次起只传改动文件。

**第 3 步：填 `.env`**

```bash
cd ~/litellm-src
# 沿用原版 master key，客户端不用改 key
grep LITELLM_MASTER_KEY /home/hifen37/ollama-litellm/.env >> .env
# 新库的密码，随便起一个
echo 'PG_PASSWORD=<新密码>' >> .env
```

**第 4 步：启动**

```bash
cd ~/litellm-src
docker compose -f docker-compose.cn.yml -p litellm-cn up -d
docker compose -p litellm-cn logs -f litellm-cn
```

首次启动会执行 `prisma migrate deploy` 建表，加上价格表拉取（已用 `LITELLM_LOCAL_MODEL_COST_MAP=True` 跳过），30-60 秒可用。

**第 5 步：验证**

```bash
bash server-deploy/verify.sh
```

### 4.3 挂载明细（`docker-compose.cn.yml`）

| 宿主机路径 | 容器路径 | 作用 |
|---|---|---|
| `./litellm_config.cn.yaml` | `/app/config.yaml` | 配置（ro） |
| `./litellm` | `/app/.venv/lib/python3.13/site-packages/litellm` | **fork 源码覆盖**（**必须可读写**，见坑 4） |
| `./litellm_cn` | `/app/litellm_cn` | 中文错误中间件包（ro） |
| `./rust_bridge/_native.abi3.so` | `.../litellm/rust_bridge/_native.abi3.so` | 补回被覆盖的 Rust 扩展 |
| `./litellm-proxy-extras/litellm_proxy_extras` | `.../litellm_proxy_extras` | **补版本漂移**（坑 3），少了它启动直接 ImportError |
| `/home/hifen37/ollama-litellm/patches` | `/app/patches` | 沿用原版的 Ollama 缓存计数补丁 |

`litellm_cn` 之所以能被 import，靠的是 `proxy_cli.py:50` 的 `sys.path.append(os.getcwd())`，容器 WORKDIR 是 `/app`，所以 `/app/litellm_cn` 自动进 path，无需改 PYTHONPATH。

### 4.4 配置文件改了什么

`litellm_config.cn.yaml` 完全沿用现有 `litellm_config.yaml`（num_ctx / keep_alive / reasoning_effort 等全部保留），只改三处：

1. **token 计费**：5 个模型的 `input_cost_per_token` / `output_cost_per_token` 从 `0` 改为 `1.0`
   → 这是二开需求 05 的第一阶段，改完 `spend` 数值就等于 token 数，`max_budget` 立刻生效
   → 想先验证原版一致性，把这两项改回 `0` 即可
2. **补 `cache_creation_input_token_cost` / `cache_read_input_token_cost` = 1.0**（坑 5）
   → 不补的话输入 token 全部免费，`spend` 只统计输出 token
3. **`database_url`** 指向新的独立库（通过 `DATABASE_URL` 环境变量，与配置解耦）

### 4.5 实测排障记录（2026-09-18 首次部署逐条踩过）

按发生顺序，都是挂载方案特有的，构建自有镜像后 1/2/3 自然消失。

**① `set: pipefail: 无效的选项名`**
脚本经 SFTP 上传后带上了 CRLF 换行，`set -euo pipefail\r` 被当成无效选项。
修：`sed -i 's/\r$//' server-deploy/*.sh *.yml *.yaml`。

**② `error mounting ... _native.abi3.so: read-only file system`**
`./litellm` 以 `:ro` 挂载时，Docker 无法在其中为嵌套的 `.so` 创建挂载点文件。
修：把 `./litellm` 那一行改成可读写（去掉 `:ro`）。代价是容器内可能往源码树写 `__pycache__`，已被 `.gitignore` 覆盖。

**③ `ImportError: cannot import name 'prisma_cli_available' from 'litellm_proxy_extras.prisma_toolchain'`**
fork 的 `proxy_cli.py`（1.102.0）比镜像内置的 `litellm_proxy_extras`（0.4.94，**167 个迁移**）新；fork 侧是 0.4.97、**175 个迁移**。
修：额外挂载 `./litellm-proxy-extras/litellm_proxy_extras`。只补单个文件也能启动，但迁移数与 `schema.prisma` 会对不上，**必须整包挂**。

**④ `verify.sh` 全部「拿不到 LITELLM_MASTER_KEY」**
非交互执行（`ssh host "cmd"`）时 `$HOME` 可能未设，`$HOME/litellm-src` 展开成 `/litellm-src`。
修：脚本已加回退 `[ -f "$BASE/.env" ] || BASE="$(cd "$(dirname "$0")/.." && pwd)"`；也可以显式 `BASE=~/litellm-src bash server-deploy/verify.sh`。

**⑤ token 计费只算输出 token（最隐蔽的一个）**
开了 `LITELLM_OLLAMA_CACHE_CREATION=1` 后，prompt token 会被整段记为 cache-write，而 `cache_creation_input_token_cost` 默认 **0**。
实测 16 进 / 2 出的请求 `spend` 只有 **2.0**。启动时日志也有 WARNING 提示（`... will default to 0 for this model`）。
修：每个模型补 `cache_creation_input_token_cost: 1.0` 与 `cache_read_input_token_cost: 1.0`，之后实测 `spend = 18.0 = total_tokens`。

**⑥ 用 master key 查 `/key/info` 返回 404 `Key not found in database`**
master key 不在虚拟密钥表里。要验 spend 必须**先建一把虚拟密钥再查它**，`verify.sh` 第 9 项已自动完成这一步。

**⑦ 已注册但看不出版本**
`litellm.__version__` 读的是镜像安装元数据（恒为 1.101.0），源码被挂载覆盖后不会变。
判断 fork 是否生效要用专属标记：`grep -c 'CN-FORK' .../litellm/proxy/proxy_server.py`（当前 2 处）。

---

## 5. 阶段二：路径 B —— 构建自有镜像

定版后再做。相比官方 Dockerfile 需要三处改造（`build-image.sh` 已自动化）：

1. **注入 PyPI 清华源**：Dockerfile 里的 `uv sync` 默认走 `files.pythonhosted.org`。脚本用 sed 在两个 builder 阶段插入 `ENV UV_DEFAULT_INDEX`。
2. **Docker Hub 镜像源**：`UI_BUILD_IMAGE`（node:24）是已声明的 ARG，用 `--build-arg` 指向镜像站即可。
3. **补 `COPY litellm_cn /app/litellm_cn`**（坑 1）：否则中文中间件静默失效。

```bash
bash server-deploy/build-image.sh          # 产出 litellm-cn:1.102.0
```

然后把 `docker-compose.cn.yml` 里的 `image:` 换成 `litellm-cn:1.102.0`、删掉三个源码挂载即可。

---

## 6. 启动后如何验证（三种手段）

### 6.1 健康端点

| 端点 | 期望 |
|---|---|
| `http://192.168.100.123:4001/health/liveliness` | `I'm alive!` |
| `http://192.168.100.123:4001/health/readiness` | `{"status":"healthy","db":"connected"}`（DB 断连返回 503） |
| `http://192.168.100.123:4001/health/readiness/details` | 需鉴权，返回 DB/缓存/回调明细 |
| `http://192.168.100.123:4001/health/backlog` | 需鉴权，在途请求数 |
| `http://192.168.100.123:4001/metrics` | Prometheus 指标（无鉴权） |

### 6.2 接口冒烟

```bash
KEY=<master key>
# 模型列表
curl -s http://192.168.100.123:4001/v1/models -H "Authorization: Bearer $KEY"
# 真实调用（走宿主机 Ollama）
curl -s http://192.168.100.123:4001/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"qwen38-27b-fast","messages":[{"role":"user","content":"你好"}]}'
# 查用量：spend 应等于 token 数（token 计费验收点）
# 注意：master key 不在虚拟密钥表里，用它查 /key/info 只会 404，必须先建一把虚拟密钥
VK=$(curl -s http://192.168.100.123:4001/key/generate -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" -d '{"models":["qwen38-iq3s"]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["key"])')
curl -s http://192.168.100.123:4001/v1/chat/completions -H "Authorization: Bearer $VK" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen38-iq3s","messages":[{"role":"user","content":"你好"}],"max_tokens":32}'
sleep 12   # spend 经 Redis 异步落库
curl -s http://192.168.100.123:4001/key/info -H "Authorization: Bearer $VK"
# 期望 spend 等于该密钥累计的「输入+输出」token 数，例如 18 个 token → "spend": 18.0
```

### 6.3 中文错误中间件专项（验证二开真正生效）

```bash
# 用错误 key 触发 401，期望返回中文而非英文
curl -s http://192.168.100.123:4001/v1/models -H "Authorization: Bearer sk-wrong"
# 期望：认证失败：代理服务器令牌无效。收到的 API Key = sk-...ong，令牌哈希 = ...。
# 若仍是英文 "Authentication Error, Invalid proxy server token passed." → 说明 litellm_cn 没被 import，检查挂载

docker exec litellm-cn /app/.venv/bin/python -c "import litellm_cn; print('litellm_cn OK')"
```

中间件是否真的挂到 app 上（光能 import 不算）：

```bash
docker exec litellm-cn /app/.venv/bin/python -c "
import litellm.proxy.proxy_server as p
print([m.cls.__name__ for m in p.app.user_middleware])"
# 期望列表末尾出现 'ErrorHandlerMiddleware'
```

### 6.4 控制台

`http://192.168.100.123:4001/ui/`
注意：此时仍是**英文界面**——仓库里 `litellm/proxy/_experimental/out/` 是上游预构建产物。要看汉化效果，得先把 `ui/litellm-dashboard` 构建好（见 7.2）。

---

## 7. 后续两步

### 7.1 切换（验证通过后）

保守做法，不删原版：

```bash
# 1. 停原版（保留容器与数据，随时可起）
docker stop litellm
# 2. 把二开版改挂 4000
sed -i 's/4001:4000/4000:4000/' ~/litellm-src/docker-compose.cn.yml
docker compose -p litellm-cn up -d
```

回滚：`docker start litellm`，二开版改回 4001。

### 7.2 汉化 UI 上线

UI 源码在 `ui/litellm-dashboard`，需要 Node ≥ 24.14.1。服务器无 node，两种做法：

- **推荐**：本机（Windows，`D:\tool\node.exe` 是 24.21.0）`npm ci && npm run build`，把 `out/` 上传到 `~/litellm-src/ui_cn/`，compose 里加 `LITELLM_UI_PATH=/app/ui_cn` 与对应挂载 —— 不进镜像，改一次传一次
- 或在服务器装 Node（`nodejs.org` 可达）后自行构建

---

## 8. 文件清单

| 文件 | 作用 |
|---|---|
| `README-部署方案.md` | 本文档（上传模式） |
| `README-VSCode远程开发.md` | **远程开发模式**：SSH 免密、代码搬运、VS Code 配置、开发循环 |
| `vscode/settings.json` / `extensions.json` | 复制到仓库 `.vscode/`（大仓库必须调优，否则卡） |
| `docker-compose.cn.yml` | 二开版编排（4001 + 独立库/缓存） |
| `litellm_config.cn.yaml` | 配置（沿用原版调优 + token 计费） |
| `sync_fork.py` | 上传模式专用：本机 → 服务器增量上传源码（远程开发模式用不到） |
| `server_init.sh` | 服务器端初始化（建目录、取 .so、生成 .env） |
| `setup-remote.ps1` | **一键**：Windows 侧把仓库同步到服务器并搭好远程开发环境 |
| `verify.sh` | 一键验证（健康/模型/中文错误/调用/用量） |
| `build-image.sh` | 阶段二：生成改造后的 Dockerfile 并构建自有镜像 |

> 密码不要写进这些文件，通过 `LITELLM_SERVER_PWD` 环境变量传入。

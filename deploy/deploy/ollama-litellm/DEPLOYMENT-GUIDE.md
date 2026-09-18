# 内网私有 LLM 服务部署文档

Ollama（推理） + LiteLLM（网关）单机部署的完整记录。所有命令与结论均在本机实测验证过。

---

## 0. 环境档案

### 硬件

| 项 | 规格 |
|---|---|
| 主机 | `hifen37-MS-7B23`，Ubuntu 24.04 + GNOME |
| 内网 IP | `192.168.100.123` |
| GPU | **RTX 5060 Ti 16GB**（可用 16311 MiB），单卡 |
| 架构 | Blackwell `sm_120`，驱动 595.91.07 / CUDA 13.2 |
| 显存带宽 | **448 GB/s**（128-bit）← 性能天花板 |
| 内存 | 30 Gi（可用 28 Gi），swap 8 Gi |
| 磁盘 | NVMe 1.8T，可用 1.7T |

**唯一的瓶颈是显卡**：容量 16GB 决定能跑多大模型，带宽 448 GB/s 决定多快。内存和磁盘富余到不用关心。

> Ollama 自带 CUDA runtime，**宿主机不需要装 CUDA Toolkit**，只要驱动就绪即可。

### 网络现状（决定所有安装方式）

| 目标 | 情况 |
|---|---|
| Docker Hub | **基本不通**（3.5GB 镜像 3 分钟只下 3MB） |
| ollama.com / GitHub | **通畅**，aria2 可跑满 16 MiB/s |
| ghcr.io（LiteLLM 镜像） | 可拉取，已落地本地 |
| 可用 Docker 加速源 | `docker.1panel.live`、`docker.m.daocloud.io`、`hub.rat.dev` |

**大文件下载一律用 aria2**：

```bash
aria2c -c -x 16 -s 16 -d /tmp -o ollama.tar.zst \
  https://ollama.com/download/ollama-linux-amd64.tar.zst
# 中断了重跑同一条命令即可续传
```

### 最终架构

```
用户 / Claude Code / 第三方客户端
        │  仅能访问 4000
        ▼
┌──────────────────────────────────┐
│ LiteLLM 网关 (Docker, :4000)     │  鉴权 · 虚拟 key · 配额 · 限流 · 计量
│  ├── Postgres 16  (127.0.0.1)    │  虚拟 key / 团队 / 花费明细
│  └── Redis 7      (127.0.0.1)    │  限流计数 / 预算预扣 / key 缓存
└──────────────────────────────────┘
        │  172.17.0.1:11434（容器 → 宿主机）
        ▼
┌──────────────────────────────────┐
│ Ollama (systemd, :11434)         │  qwen3:8b / qwen3.5:9b / qwen3:14b
│ llama-server (llama.cpp)         │  CUDA · FlashAttention
└──────────────────────────────────┘
        │
        ▼
    RTX 5060 Ti 16GB
```

### 端口总表

| 端口 | 服务 | 防火墙策略 |
|---|---|---|
| `4000` | LiteLLM 网关 + 管理界面 | `ALLOW 192.168.100.0/24` |
| `11434` | Ollama | `DENY 192.168.100.0/24` + `ALLOW 172.16.0.0/12` |
| `5432` | Postgres | 仅绑定 `127.0.0.1` |
| `6379` | Redis | 仅绑定 `127.0.0.1` |

---

## 1. Docker 与 GPU 运行时

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
sudo usermod -aG docker $USER     # 需重新登录生效

# 验证容器可见显卡
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

> 漏掉 `nvidia-container-toolkit` 时容器会**静默降级到 CPU**，不报错但慢几十倍。

---

## 2. Ollama 原生安装

Docker 镜像 3.5GB 且拉不动，改用原生安装（1.3GB，走 ollama.com 链路快）。

```bash
sudo apt-get install -y aria2 zstd
aria2c -c -x 16 -s 16 -d /tmp -o ollama.tar.zst \
  https://ollama.com/download/ollama-linux-amd64.tar.zst

sudo tar -I zstd -xvf /tmp/ollama.tar.zst -C /usr/local
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama 2>/dev/null
ollama --version
```

**必须确认两个二进制都在**，缺 `llama-server` 时 `--version` 正常但 `serve` 直接崩：

```
/usr/local/bin/ollama              # 主程序
/usr/local/lib/ollama/llama-server # 推理引擎
```

服务文件 `/etc/systemd/system/ollama.service` 与覆盖配置 `/etc/systemd/system/ollama.service.d/override.conf`：

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_CONTEXT_LENGTH=32768"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_FLASH_ATTENTION=1"
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ollama
curl http://127.0.0.1:11434/api/tags     # 返回 {"models":[]} 即就绪
```

### 关键参数取舍

| 参数 | 值 | 理由 |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0:11434` | 默认只听 127.0.0.1，容器连不上 |
| `OLLAMA_CONTEXT_LENGTH` | **32768** | Agent 场景刚需，见第 6 节 |
| `OLLAMA_NUM_PARALLEL` | **1** | 32768 上下文单槽 KV ≈ 4.8GB，开 4 槽必爆 |
| `OLLAMA_KEEP_ALIVE` | `24h` | 默认 5 分钟会卸载，下次请求冷启动几十秒 |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | 三个模型加起来远超 16GB |

显存算式：`权重 5.2GB + 32768 上下文 KV 4.8GB ≈ 10GB`，实测 9840 MiB。

> **场景化取舍**：跑 Claude Code 这类 Agent 时上下文优先（32768 / 并发 1）；
> 如果只是给团队做日常对话服务，反过来更划算：`CONTEXT_LENGTH=8192` + `NUM_PARALLEL=4`，
> 显存占用一样约 10GB，但能同时服务 4 个人。改完记得同步 `litellm_config.yaml` 里的 `num_ctx`。

---

## 3. 模型管理

```bash
ollama pull qwen3:8b        # 5.2GB
ollama pull qwen3.5:9b      # 6.6GB  推荐
ollama pull qwen3:14b       # 9.3GB
ollama list                 # 已装列表
ollama ps                   # PROCESSOR 必须是 100% GPU
ollama rm <name>            # 删除释放空间
```

**验证标准只有一条**：`ollama ps` 的 `PROCESSOR` 列显示 `100% GPU`。出现百分比混合说明显存不够被切分到 CPU，换小一档。

### 现存模型

| 模型 | 大小 | 用途 |
|---|---|---|
| `qwen3:8b` | 5.2 GB | 基础对话，速度快 |
| `qwen3.5:9b` | 6.6 GB | **当前推荐** |
| `qwen3:14b` | 9.3 GB | 质量最好，速度约一半 |

三个只能驻留一个（`MAX_LOADED_MODELS=1`），切换有几十秒加载延迟。

### 下载中断的处理

`ollama pull` 中途失败会留下残缺 blob——`/api/tags` 能列出模型，但 `/api/chat` 报 `model not found`。删掉重拉即可。**用 aria2 拉 GGUF 再 Modelfile 导入更稳**。

---

## 4. LiteLLM 网关部署

`~/ollama-litellm/` 目录下三个文件：`docker-compose.yml`、`litellm_config.yaml`、`.env`。

```bash
cd ~/ollama-litellm
docker compose up -d
docker compose ps        # 三个容器都应 Up (healthy)
curl http://127.0.0.1:4000/health/liveliness   # 返回 "I'm alive!"
```

**首次启动需要 3-5 分钟**：Prisma 迁移（165 个）+ 连接 GitHub 拉价格表超时重试（约 22 秒，失败后会回退到镜像内置备份，属正常降级）。别在它起来之前判定失败。

### 连通性关键配置

`.env`：

```
LITELLM_MASTER_KEY=<管理员钥匙>
OLLAMA_API_BASE=http://172.17.0.1:11434
```

容器内访问宿主机有两种写法，实测 **`172.17.0.1` 比 `host.docker.internal` 更可靠**（纯 IP 不依赖 host-gateway 特性）。

### 模型配置要点

```yaml
model_list:
  - model_name: qwen3.5
    litellm_params:
      model: ollama_chat/qwen3.5:9b      # ← 必须是 ollama_chat 前缀
      api_base: os.environ/OLLAMA_API_BASE
      num_ctx: 32768
      reasoning_effort: none
      input_cost_per_token: 0
      output_cost_per_token: 0
```

两个必须注意的细节：

1. **`ollama_chat/` 而非 `ollama/`**。前者走 `/api/chat` 保留结构化消息与工具调用；后者走 `/api/generate`，把多轮对话拼成纯文本，工具调用直接失效。
2. **只允许配置 `ollama list` 里存在的模型**。配了不存在的模型，LiteLLM 启动时会反复重试注册，白等 2 分钟以上。这条踩过两次。

---

## 5. 防火墙（最容易踩的坑）

```bash
sudo ufw delete deny 11434/tcp
sudo ufw deny from 192.168.100.0/24 to any port 11434 comment 'block LAN direct ollama'
sudo ufw allow from 172.16.0.0/12 to any port 11434 comment 'docker bridge to ollama'
sudo ufw allow from 192.168.100.0/24 to any port 4000 comment 'LiteLLM gateway'
sudo ufw reload
```

三条铁律：

1. **`DENY Anywhere` 会连 Docker 容器一起挡掉**。容器走 `172.16.0.0/12` 网桥，在 ufw 眼里属于外来流量。这会导致网关起来了但调不通模型，现象是请求挂到超时。
2. **ufw 按添加顺序匹配**。必须先删掉旧的宽泛 DENY，后加的精确 ALLOW 才生效。
3. **不要把 11434 暴露给局域网**，否则任何人都能绕过网关直接打满 GPU，配额和计量全部失效。

---

## 6. 对接 Claude Code（重点）

这块排查最久，结论和直觉相反，逐一记录。

### 6.1 现象

Claude Code 里提问后显示 `Thought for 17s`，之后没有任何正文，偶尔吐出系统提示词的碎片。

### 6.2 排查过程（四项验证）

| 嫌疑 | 方法 | 结论 |
|---|---|---|
| 流式 SSE 有问题 | 导出原始字节流 | **排除**：事件序列 `message_start → content_block_start → content_block_delta → content_block_stop → message_delta → message_stop` 完整 |
| 思考模式导致无输出 | 对比 thinking 开/关 | **排除**：`max_tokens` 给足时带 thinking 也能正常返回 tool_use |
| **`num_ctx` 不足** | 发送超长 prompt 对比 `input_tokens` | **确认根因** |
| 模型质量差 | 观察生成结果 | 次要问题（偶发语法错误） |

### 6.3 根因：prompt 被静默截断

```
发送约  8100 token  →  网关 input_tokens: 4682
发送约 26700 token  →  网关 input_tokens: 4098   ← 砍掉 85%
```

Claude Code 每次请求都携带庞大的系统提示词 + 十几个工具定义，本身就有 5000-10000 token。`num_ctx=8192` 装不下，**用户真正的问题被截掉了**，模型对着残缺上下文瞎猜，于是输出碎片或调用无关工具（测试中出现了 `GenericTool26` 这种根本不存在的调用）。

修复后同一请求：`input_tokens` **4098 → 14782**，工具调用恢复正常。

### 6.4 关于思考模式的补充说明

Qwen3 / Qwen3.5 默认开启思考，token 会被 `reasoning_content` 吃光导致正文为空。

```yaml
reasoning_effort: none    # LiteLLM 会翻译成 Ollama 的 think=false
```

**但这个设不住**：Claude Code 会在请求体里主动携带 `thinking:{"type":"enabled"}`，优先级高于网关配置。三种应对：

1. 客户端环境变量 `MAX_THINKING_TOKENS=0`
2. 会话内 `Alt+T` 切换
3. 换天然不支持思考的模型（`qwen2.5-coder` 系列）

> Ollama Modelfile 里的 `PARAMETER think false` **实测无效**，第三方带 `think=true` 时照样思考，别在这上面浪费时间。

### 6.5 CC Switch 配置

| 字段 | 值 |
|---|---|
| Base URL | `http://192.168.100.123:4000` |
| API Key | 你发的虚拟 key |
| Model | `qwen3.5` |
| 环境变量 | `MAX_THINKING_TOKENS=0` |

---

## 7. 用户与配额管理

### 管理后台

`http://192.168.100.123:4000/ui`，用管理员钥匙登录：

```bash
grep LITELLM_MASTER_KEY ~/ollama-litellm/.env
```

界面里可以做：发 key / 设预算 / 禁用删除 / 查看按人与按模型的花费曲线 / 团队分组。

### 命令行发 key

```bash
cd ~/ollama-litellm
bash new-key.sh <用户标识> [预算] [有效期] [并发] [模型列表]
bash new-key.sh lisi                       # 100 / 30d / 并发 2 / qwen3-8b+qwen3.5
bash new-key.sh wangwu 200 7d 1 qwen3-8b   # 只给 8b
```

### 配额字段对照

| 字段 | 单位 | 用途 |
|---|---|---|
| `max_budget` | **金额** | 总额度，配合 `budget_duration` 周期重置 |
| `tpm_limit` | token/分钟 | 速率限制 |
| `rpm_limit` | 请求/分钟 | 速率限制 |
| `max_parallel_requests` | 并发数 | 同时进行中的请求 |
| `model_max_budget` / `model_tpm_limit` | — | 按模型单独配额 |

### ⚠ 当前状态：max_budget 是失效的

因为本地模型单价设为 0，`spend` 永远为 0，配额不会触发。**要实现按 token 配额，把单价改造成计数单位**：

```yaml
input_cost_per_token: 0.001      # 1 token = 0.001 单位
output_cost_per_token: 0.001
# max_budget=1000  →  100 万 token 配额
```

换算：`想给的 token 数 × 0.001 = max_budget 值`。UI 里显示的 `$123.45` 代表 123450 token。

更简单的即时方案是只配速率限制（**不受单价影响，立刻生效**）：

```bash
curl -X POST http://127.0.0.1:4000/key/update \
  -H "Authorization: Bearer <master key>" -H "Content-Type: application/json" \
  -d '{"key":"sk-xxx","tpm_limit":50000,"rpm_limit":20,"max_parallel_requests":2}'
```

### 排查 key 时注意

`/key/list` **出于安全只返回 token 哈希**（`{"keys":["<hash>"],"total_count":N}`），不是完整对象列表。查明细用 `/key/info` 或直接读库：

```bash
docker compose exec -T db psql -U llmproxy -d litellm \
  -c 'SELECT key_alias, models, max_budget, spend FROM "LiteLLM_VerificationToken";'
```

---

## 8. 日常运维

### 常用命令

```bash
# 服务状态
systemctl status ollama --no-pager
cd ~/ollama-litellm && docker compose ps

# 日志
sudo journalctl -u ollama -f
cd ~/ollama-litellm && docker compose logs -f litellm

# 显存与驻留模型
nvidia-smi
ollama ps

# 重启网关（不要只重启某一个容器，Redis 断连会让 LiteLLM 起不来）
cd ~/ollama-litellm && docker compose restart litellm
```

### 健康检查脚本

```bash
cd ~/ollama-litellm && bash diagnose.sh    # 7 段一次性诊断
GW=http://127.0.0.1:4000 KEY=<key> bash test-e2e.sh
```

### 备份

数据在 Docker volume 里，**删除容器不会丢数据，删除 volume 会**：

```bash
# 数据库
docker compose exec -T db pg_dump -U llmproxy litellm > backup-$(date +%F).sql

# 完整 volume
tar czf litellm-data-$(date +%F).tar.gz ~/ollama-litellm/data
```

建议每周一次，保留 4 周。

### 升级

```bash
docker compose pull litellm
docker compose up -d litellm
```

数据库迁移在启动时同步执行，**会有短暂不可用**，别在业务高峰滚。

```bash
ollama --version    # Ollama 升级参考第 2 节重新安装
```

### 交付的脚本清单

| 文件 | 用途 |
|---|---|
| `deploy.sh` | Ollama 原生部署（含权限修复、服务文件写入、拉模型） |
| `deploy-gateway.sh` | 网关部署（自动生成密钥、探测 ghcr.io 决定方案） |
| `diagnose.sh` | 7 段诊断：服务 / 模型 / 推理 / 显存 / 防火墙 / 容器连通性 / 网关日志 |
| `check-machine.sh` | 部署前机器体检，按显存推荐模型 |
| `new-key.sh` | 发虚拟 key |
| `test-e2e.sh` | 7 项端到端验证 |
| `cc-longctx-test.py` | 长上下文截断检测（Claude Code 排障利器） |

---

## 9. 故障速查表

| 症状 | 原因 | 处理 |
|---|---|---|
| `llama-server binary not found` | 解压不完整 | 重新 `tar -I zstd -xvf`，确认两个二进制都在 |
| `service is inactive`，journalctl 无记录 | systemd 未成功启动 | `/usr/local/bin/ollama serve` 前台直跑看真实报错 |
| 网关 curl 超时 | ①本机有代理 ②ufw 挡了容器 ③还没启动完 | `curl --noproxy '*'`；第 5 节防火墙；首启等 3-5 分钟 |
| 报 `os error 10061` | **Windows 代理软件拦截**，不是服务器返回 | 加 `--noproxy '*'` |
| 花费用一直是 0 | 单价设为 0 | 见第 7 节单价改造 |
| 模型能列出但调不动 | 权重 blob 残缺 | `ollama rm` 后重拉 |
| Claude Code 输出碎片 | `num_ctx` 不足导致截断 | 提到 32768，见第 6 节 |
| Claude Code 转圈无输出 | 客户端强制 thinking | `MAX_THINKING_TOKENS=0` |
| 容器内连不上 Ollama | ufw 挡了 Docker 网段 | `ufw allow from 172.16.0.0/12 to any port 11434` |
| 响应极慢 | 显存放不下 KV 被 offload 到内存 | 降 `num_ctx` 或 `NUM_PARALLEL` |

> 排查服务起不来的通用绝招：`/usr/local/bin/ollama serve` **前台直接跑**，能以和 systemd 相同的身份暴露真实错误，比翻 journalctl 有效得多。

---

## 10. 已知限制与待办

### 安全（优先处理）

- [ ] **服务器口令 `123456` 必须修改**：`passwd`
- [ ] 管理员钥匙妥善保管，不要发给同事
- [ ] 清理无用虚拟 key：数据库里有一把无别名的历史 key

### 能力边界

| 项 | 现状 |
|---|---|
| 建议并发 | 1-2 路（32768 上下文下） |
| 单请求速度 | 8B 约 45-55 tok/s，14B 约 25-35 tok/s |
| 适合场景 | 5-20 人内部轻量使用：问答、文案、代码辅助、RAG |
| 不适合 | 高并发生产服务、批量文档处理 |

### 后续优化方向

1. **认真用 Claude Code**：拉 `qwen2.5-coder:14b`（9GB），天然无思考 + 代码能力強，比通用模型合适得多
2. **并发上量**：把推理层换成 vLLM，连续批处理能大幅提升吞吐，网关配置无需改动，只换 `model_list` 里的前缀和 `api_base`
3. **启用 token 配额**：按第 7 节改造单价
4. **关闭桌面省资源**：`sudo systemctl set-default multi-user.target && sudo reboot`，可省 1-2GB 内存和约 120MB 显存

---

## 附录 A：一次完整的新装流程

```bash
# 1. Docker + GPU 运行时
sudo apt-get install -y docker.io docker-compose-plugin nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker

# 2. Ollama
aria2c -c -x 16 -s 16 -d /tmp -o ollama.tar.zst \
  https://ollama.com/download/ollama-linux-amd64.tar.zst
sudo tar -I zstd -xvf /tmp/ollama.tar.zst -C /usr/local
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama

# 3. 写服务配置（第 2 节内容）后启动
sudo systemctl daemon-reload && sudo systemctl enable --now ollama

# 4. 拉模型
ollama pull qwen3.5:9b
ollama ps          # 确认 100% GPU

# 5. 网关
cd ~/ollama-litellm && docker compose up -d
curl http://127.0.0.1:4000/health/liveliness

# 6. 防火墙（第 5 节）

# 7. 发 key
bash new-key.sh lisi
```

## 附录 B：凭据与路径

| 项 | 位置 |
|---|---|
| 管理员钥匙 | `~/ollama-litellm/.env` 的 `LITELLM_MASTER_KEY` |
| 数据库密码 | 同上，`PG_PASSWORD` |
| 网关配置 | `~/ollama-litellm/litellm_config.yaml` |
| Ollama 服务 | `/etc/systemd/system/ollama.service` + `service.d/override.conf` |
| 模型文件 | `/usr/share/ollama/.ollama/models` |
| 容器数据 | `~/ollama-litellm/data/{postgres,redis}` |

> 本文档不含任何明文凭据，需要时从服务器读取。

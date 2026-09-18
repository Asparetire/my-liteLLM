# 全原生部署（不依赖 Docker Hub / ghcr.io）

适用：镜像仓库拉不动的环境。Ollama、LiteLLM 都用原生方式安装，只有 Postgres/Redis 可选容器。

---

## 1. Ollama（宿主机，systemd）

安装：`curl -fsSL https://ollama.com/install.sh | sh`

装完改配置，**关键是让 Ollama 监听 0.0.0.0**，否则其它容器连不上：

```bash
sudo systemctl edit ollama
```

填入：

```
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_FLASH_ATTENTION=1"
```

```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
curl http://localhost:11434/api/tags          # 返回 {"models":[]} 即正常
ollama pull qwen3:14b
ollama ps                                     # PROCESSOR 必须是 100% GPU
```

模型默认存在 `/usr/share/ollama/.ollama/models`（1.7T 磁盘无需改位置）。

---

## 2. LiteLLM（宿主机，pip）

> 官方镜像在 **ghcr.io**，`registry-mirrors` 只对 Docker Hub 生效，对它无效。
> 拉不动就走 pip，PyPI 可以配国内源，速度快得多。

```bash
sudo apt-get install -y python3-pip python3-venv
python3 -m venv ~/litellm-venv
~/litellm-venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple 'litellm[proxy]'
```

改配置：把 `litellm_config.yaml` 里所有 `api_base` 改成

```yaml
      api_base: http://127.0.0.1:11434
```

建 systemd 服务：

```bash
sudo tee /etc/systemd/system/litellm.service <<'EOF'
[Unit]
Description=LiteLLM Proxy
After=network.target ollama.service postgresql.service redis-server.service

[Service]
Type=simple
User=hifen37
WorkingDirectory=/home/hifen37/ollama-litellm
Environment="LITELLM_MASTER_KEY=改成随机串"
Environment="DATABASE_URL=postgresql://llmproxy:改成密码@localhost:5432/litellm"
Environment="REDIS_HOST=localhost"
Environment="REDIS_PORT=6379"
ExecStart=/home/hifen37/litellm-venv/bin/litellm --config /home/hifen37/ollama-litellm/litellm_config.yaml --port 4000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now litellm
sudo journalctl -u litellm -f
```

验证：`curl http://localhost:4000/health/liveliness`

---

## 3. Postgres 与 Redis

能拉镜像就继续用 `docker-compose.yml` 里的 `db`、`redis` 两个服务（体积小，配了加速源通常没问题）。

拉不动就 apt 装：

```bash
sudo apt-get install -y postgresql redis-server
sudo -u postgres psql -c "CREATE USER llmproxy WITH PASSWORD '改成密码';"
sudo -u postgres psql -c "CREATE DATABASE litellm OWNER llmproxy;"
sudo systemctl enable --now postgresql redis-server
```

LiteLLM 首次启动会自动跑 Prisma 迁移建表。

---

## 4. 常用运维

```bash
sudo systemctl status ollama litellm        # 状态
sudo journalctl -u ollama -f                # Ollama 日志
sudo journalctl -u litellm -f               # 网关日志
nvidia-smi                                  # 显存
ollama ps                                   # 模型驻留情况
```

## 5. 升级

```bash
# Ollama
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl restart ollama

# LiteLLM
~/litellm-venv/bin/pip install -U 'litellm[proxy]'
sudo systemctl restart litellm
```

升级 LiteLLM 前注意：它会同步执行数据库迁移，期间服务不可用，别在业务高峰做。

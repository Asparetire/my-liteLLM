# LiteLLM 网关使用手册

部署地址：`http://192.168.100.123:4000`
管理后台：`http://192.168.100.123:4000/ui`（用 master key 登录）

---

## 1. 你的钥匙在哪里

```bash
cd ~/ollama-litellm && cat .env
```

- `LITELLM_MASTER_KEY` —— **管理员钥匙**，能发 key、看所有人的花费、改配置。**绝对不要发给同事**，只在运维时用。
- 发给同事的是另外生成的**虚拟 key**，一人一把。

---

## 2. 给同事发 key

```bash
cd ~/ollama-litellm
bash new-key.sh zhangsan              # 预算 100 / 30 天 / 并发 2
bash new-key.sh lisi 50 7d 1          # 预算 50 / 7 天 / 并发 1
```

脚本会直接打印 key 和对方的接入代码，复制发给本人即可。

也可以直接在管理后台点鼠标：`http://<IP>:4000/ui` → **Virtual Keys** → **+ Create new key**。

> 本地模型不产生真实费用，`max_budget` 是内部配额单位，主要用来**防止单个人把 GPU 打满**。

---

## 3. 同事怎么用

### Python（推荐，改一行代码即可）

```python
from openai import OpenAI
client = OpenAI(
    base_url="http://192.168.100.123:4000/v1",
    api_key="sk-xxxx发给他的一把xxxx",
)
resp = client.chat.completions.create(
    model="qwen3-8b",
    messages=[{"role": "user", "content": "帮我写一段自我介绍"}],
)
print(resp.choices[0].message.content)
```

### curl

```bash
curl http://192.168.100.123:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"你好"}]}'
```

### 第三方客户端（Chatbox / NextChat / LibreChat 等）

选 OpenAI 兼容，接口地址填 `http://192.168.100.123:4000/v1`，模型名填 `qwen3-8b`，密钥填发给他的那把。

### 流式输出

改一个参数即可：`client.chat.completions.create(..., stream=True)`。

---

## 4. 可用模型名

| 网关里的名字 | 说明 |
|---|---|
| `qwen3-8b` | 主力对话模型 |
| `qwen3-embed` | 嵌入模型，给知识库用 |

同事**只能看到自己 key 里授权过的模型**，看不到模型背后的真实部署。

---

## 5. 看用量

管理后台最直观：`/ui` → **Usage** 页，能看到按人、按天的花费曲线。

命令行：

```bash
source .env
# 全部汇总
curl -s http://127.0.0.1:4000/global/spend/report -H "Authorization: Bearer $LITELLM_MASTER_KEY" | python3 -m json.tool
# 某把 key 的明细
curl -s http://127.0.0.1:4000/key/spend/report -H "Authorization: Bearer $LITELLM_MASTER_KEY" | python3 -m json.tool
# 列出所有 key
curl -s http://127.0.0.1:4000/key/list -H "Authorization: Bearer $LITELLM_MASTER_KEY" | python3 -m json.tool
```

---

## 6. 权限模型（三层）

```
团队 Team  ── 部门预算池
   └── 用户 User ── 按人统计
         └── 虚拟 Key ── 一把具体的 sk-xxx，可单独限模型/并发/预算/有效期
```

单人滥用只影响他自己的 key，不会拖垮其他人。想调整某个人的额度，重新发一把 key 或 `/key/update` 即可。

---

## 7. 日常运维

```bash
docker compose ps                       # 各组件状态
docker compose logs -f litellm          # 网关日志（排障先看这个）
docker compose restart litellm          # 重启网关
sudo journalctl -u ollama -f            # Ollama 日志
nvidia-smi                              # 显存占用
ollama ps                               # 模型驻留，PROCESSOR 应为 100% GPU
```

## 8. 安全边界（重要）

| 端口 | 服务 | 应该对谁开放 |
|---|---|---|
| 4000 | LiteLLM 网关 | **内网同事** ← 唯一入口 |
| 11434 | Ollama | **仅本机**，必须挡住（绕过网关即绕过计量） |
| 5432 | Postgres | **仅本机** |
| 6379 | Redis | **仅本机** |

加固命令（如果还没做）：

```bash
sudo ufw deny 11434/tcp
sudo ufw allow from 192.168.100.0/24 to any port 4000
sudo ufw reload
```

## 9. 容量参考（RTX 5060 Ti 16GB）

- 单请求：约 45-55 tok/s
- 并发建议：2-4 路（超过会明显排队）
- 适合：5-20 人轻量使用（问答、文案、代码辅助、RAG）
- 不适合：高并发、批量文档处理

想提升质量可换 `qwen3:8b-q8_0` 或 `qwen3:14b`（都要先 `ollama pull`，再在 `litellm_config.yaml` 里取消注释）。

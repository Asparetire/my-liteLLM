# Ollama 使用手册（独立于网关）

Ollama 是推理引擎，本身就能对外提供服务。**就算 LiteLLM 网关暂时没起来，Ollama 也可以直接用**——它内置了 OpenAI 兼容接口。

---

## 一、先确认 Ollama 是好的

```bash
systemctl is-active ollama          # active
ollama list                          # 列出已装模型
ollama ps                            # 当前驻留显存的模型
nvidia-smi                           # 显存占用
```

## 二、命令行直接用

```bash
# 交互式对话（进入后直接打字，/bye 退出）
ollama run qwen3:8b

# 一次性提问，不进交互
ollama run qwen3:8b "用一句话解释什么是向量数据库"

# 换 14b（效果更好，速度约一半）
ollama run qwen3:14b "帮我写一个快排"
```

交互模式里的常用指令：

| 指令 | 作用 |
|---|---|
| `/bye` | 退出 |
| `/set parameter num_ctx 8192` | 临时改上下文长度 |
| `/clear` | 清空对话历史 |
| `/show` | 查看当前模型信息 |
| `?` | 帮助 |

## 三、API 调用（给程序用）

Ollama 有**两套**接口，用途不同：

### 1. 原生接口 `/api/chat`

```bash
curl http://127.0.0.1:11434/api/chat -d '{
  "model": "qwen3:8b",
  "messages": [{"role":"user","content":"你好"}],
  "stream": false,
  "options": {"num_ctx": 8192}
}'
```

### 2. OpenAI 兼容接口 `/v1/chat/completions` ← 推荐给同事用

**这是最省事的一条路**：Ollama 原生支持 OpenAI 格式，任何 OpenAI SDK 把 `base_url` 指过来就能用。

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://192.168.100.123:11434/v1",   # 注意是 11434，不是 4000
    api_key="ollama"                               # 随便填，Ollama 不校验
)

r = client.chat.completions.create(
    model="qwen3:8b",
    messages=[{"role": "user", "content": "你好"}]
)
print(r.choices[0].message.content)
```

命令行验证：

```bash
curl http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"hi"}]}'
```

> Chatbox / NextChat / CC Switch 这类客户端，选「OpenAI 兼容」，地址填 `http://192.168.100.123:11434/v1`，模型名填 `qwen3:8b`，API Key 随便写。

**代价**：这条路径没有任何鉴权、限流和计量，知道地址的人都能用。所以只适合临时过渡或可信小范围。

## 四、模型管理

```bash
ollama pull qwen3:8b              # 下载
ollama rm qwen3:14b               # 删除（会一并清理权重文件）
ollama cp qwen3:8b my-qwen        # 复制成自定义名
ollama show qwen3:8b              # 查看参数、模板、上下文上限
ollama show qwen3:8b --modelfile  # 导出 Modelfile
```

模型文件位置：`/usr/share/ollama/.ollama/models`（blobs 是权重，manifests 是元数据）。

**重要**：往 LiteLLM 配置里加任何模型之前，必须先在 `ollama list` 里能看到它。否则网关启动时会反复重试注册，卡住两分钟以上——这次故障的根因就是这个。

## 五、服务配置

配置文件：`/etc/systemd/system/ollama.service`

改配置用 `sudo systemctl edit ollama`（会生成 override，不破坏原文件），改完：

```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

常用环境变量：

| 变量 | 建议值 | 说明 |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0:11434` | 监听地址。**必须 0.0.0.0，容器和局域网才连得上** |
| `OLLAMA_CONTEXT_LENGTH` | `8192` | 默认上下文。设太大会撑爆显存 |
| `OLLAMA_NUM_PARALLEL` | `2`~`4` | 并发槽位。8b 可 4，14b 建议 2 |
| `OLLAMA_KEEP_ALIVE` | `24h` | 模型驻留时间。默认 5 分钟会卸载，下次请求要重新加载几十秒 |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | 同时驻留几个模型。16GB 卡设 1，避免两个模型抢显存 |
| `OLLAMA_FLASH_ATTENTION` | `1` | 开启 Flash Attention |

## 六、日志与排障

```bash
sudo journalctl -u ollama -f              # 实时日志
sudo journalctl -u ollama -n 50 --no-pager
```

| 症状 | 原因与处理 |
|---|---|
| `model 'xxx' not found` 但 `ollama list` 里有 | 权重 blob 不完整（下载中断过）。`ollama rm` 后重拉 |
| 响应极慢（几十秒） | 显存放不下，KV cache 被 offload 到内存。降 `num_ctx` 或 `OLLAMA_NUM_PARALLEL` |
| `ollama ps` 显示 CPU/GPU 混合 | 同上，模型太大，换小一档 |
| 服务起不来，报 llama-server not found | 解压不完整。重新 `tar -I zstd -xvf ollama.tar.zst -C /usr/local` |
| 局域网访问不了 | `OLLAMA_HOST` 不是 0.0.0.0，或防火墙没放行 |

## 七、显存预算速算

```
权重 + 并发槽数 × 每槽 KV ≤ 显存 × 0.8
```

qwen3:8b（Q4_K_M）权重约 5.2GB，8192 上下文每槽约 1.2GB：

| 并发 | 总占用 | 16GB 卡是否安全 |
|---|---|---|
| 2 | 7.6 GB | 安全 |
| 4 | 10.0 GB | 安全 |
| 8 | 14.8 GB | 危险 |

qwen3:14b 权重 9.3GB，每槽约 1.8GB，并发 2 约 13GB，并发 3 就危险了。

## 八、防火墙对照

| 端口 | 建议 | 说明 |
|---|---|---|
| `11434` | 视情况 | 想让同事直连 Ollama 就放行内网段；只用网关则应对外网关闭，但**必须放行 Docker 网段**，否则容器连不上 |
| `4000` | 放行内网段 | 网关入口 |
| `5432` / `6379` | 绝不对局域网开放 | 数据库 |

如果用了 `sudo ufw deny 11434`，**它会连 Docker 容器一起挡住**。要么放行容器网段：

```bash
sudo ufw allow from 172.17.0.0/16 to any port 11434 comment 'docker to ollama'
```

要么只放行局域网但排除容器段（需要更细的规则）。最省事的做法是干脆不用 ufw 管 11434，靠 `OLLAMA_HOST` 控制。

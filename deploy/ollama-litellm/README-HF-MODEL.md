# HuggingFace 模型导入 Ollama（直连不通时的做法）

记录 2026-09-17 导入 `qwen3.8-27B IQ3_S` 的全过程，下次遇到同类问题直接照做。

## 现象

```bash
ollama run hf.co/AtomicChat/Qwen3.8-27B-GGUF:IQ3_S
```

报错：

```
Error: max retries exceeded: Get "https://huggingface.co/v2/AtomicChat/Qwen3.8-27B-GGUF/blobs/sha256:bf355...":
  dial tcp 192.133.77.191:443: connect: connection refused
```

`ollama list` 里看不到模型，但 `ls blobs/` 发现大文件其实已经下完了。

## 诊断

```bash
# 1. 网络：huggingface.co 是否可达
curl -s -o /dev/null -w "HTTP %{http_code}\n" -m 12 https://huggingface.co/     # → HTTP 000（不通）
curl -s -o /dev/null -w "HTTP %{http_code}\n" -m 12 https://hf-mirror.com/      # → HTTP 200（通）

# 2. 已下到哪了
sudo ls -lh /usr/share/ollama/.ollama/models/blobs/ | sort -k5 -n | tail

# 3. ollama 侧真实进度（CLI 的进度条会误导）
sudo journalctl -u ollama --since "30 min ago" --no-pager | grep -iE "pull|download"
```

本例中：`3e30f93acafc`（13GB 主权重）和 `2f0a90f14032`（927MB 视觉塔）**都 100% 完成**，
只有第三个 blob `bf355ca43dbf`（481 字节的元数据）一直失败 → manifest 写不出来 → 模型不注册。

## 解决：用已下载的 blob 重建

**关键点**：ollama 的 blob 文件名就是内容的 sha256。只要本地 blob 存在，
`ollama create` 的 FROM 指向它时会打印 `using existing layer` 并**零复制复用**。

```bash
# 1. 确认 blob 是有效 GGUF（前 4 字节应为 "GGUF"）
sudo head -c 4 /usr/share/ollama/.ollama/models/blobs/sha256-3e30f93acafc... | od -c

# 2. 建档。两个要点：
#    - blob 权限是 ollama 用户私有，普通用户跑会 permission denied，必须 sudo
#    - ⚠️ 只写 FROM 会埋雷！必须补 RENDERER/PARSER/参数 —— 见下一节
sudo bash -c "cat > /tmp/MF <<'EOF'
FROM /usr/share/ollama/.ollama/models/blobs/sha256-3e30f93acafc...
RENDERER qwen3.8
PARSER qwen3.5
PARAMETER temperature 1
PARAMETER top_k 20
PARAMETER top_p 0.95
PARAMETER min_p 0
PARAMETER repeat_penalty 1
PARAMETER presence_penalty 0
EOF"
sudo ollama create qwen38-iq3s -f /tmp/MF
```

输出（27 秒完成，没有复制 13GB）：

```
parsing GGUF
using existing layer sha256:3e30f93acafc...
writing manifest
success
```

## ⚠️ 必读：只写 `FROM` 会埋雷（实战踩过）

**症状**：模型能正常回答简单问题，但 Claude Code 一发消息就报
`API error · Retrying in 0s · attempt 1/10`。网关日志里是：

```
Ollama_chatException - {"error":"...Jinja Exception: System message must be at the beginning."}
POST /v1/messages?beta=true HTTP/1.1" 500 Internal Server Error
```

**根因**：`ollama create` 只能从 **GGUF 文件本身**提取信息，拿到的是 `TEMPLATE {{ .Prompt }}`
（GGUF 内置的 Jinja 模板）。而官方模型的 manifest 里有 **第 4 层 `params`**
（`application/vnd.ollama.image.params`），里面存着 `RENDERER` / `PARSER` / 默认参数 ——
这些**不在 GGUF 里，重建时全部丢失**。

丢掉 `RENDERER qwen3.8` 后，Ollama 退回执行 GGUF 那个 Jinja 模板，而它有一行严格校验：

```jinja
{{- raise_exception('System message must be at the beginning.') }}
```

只要 system message 不在数组第一位就直接抛异常。

**为什么 CLI 客户端必踩**：Claude Code / Claude Agent SDK 这类客户端在多轮会话、带 tools
的场景下，system 常常不在 messages[0]（LiteLLM 做 Anthropic→OpenAI 格式转换时也会重排）。
最简单的复现：

```bash
curl -s http://127.0.0.1:11434/api/chat -d '{"model":"qwen38-iq3s","messages":[
  {"role":"user","content":"hi"},
  {"role":"system","content":"be brief"},
  {"role":"user","content":"ok"}],"stream":false}'
# → 500 Jinja Exception: System message must be at the beginning.
```

**实测对比**（同一份 13GB 权重，只差 Modelfile 配置）：

| 场景 | 只写 FROM | 补了 RENDERER/PARSER |
|---|---|---|
| system 在最前 | OK | OK |
| **system 在中间** | **500 崩** | **OK** |
| **system 在末尾** | **500 崩** | **OK** |
| Anthropic 格式 + tools | **500 崩** | **OK，正确返回 tool_use** |

**修复**：重建时把官方模型的 `RENDERER` / `PARSER` / `PARAMETER` 一并写进去。
这些值可以直接从官方同名模型抄：

```bash
ollama show qwen3.8:27b --modelfile | grep -E '^(RENDERER|PARSER|PARAMETER)'
# 或直接读官方 params layer 的内容（一个 JSON）
sudo cat /usr/share/ollama/.ollama/models/blobs/sha256-<params层>
# → {"draft_num_predict":4,"min_p":0,"presence_penalty":0,"repeat_penalty":1,
#    "temperature":1,"top_k":20,"top_p":0.95}
```

**一句话**：用 `ollama create` 从裸 blob 重建 HF 模型时，
**Modelfile 必须对齐官方同名模型的 RENDERER/PARSER/PARAMETER**，
否则交互式客户端（Claude Code 等）会在带 system 的请求上稳定 500。

## 踩过的坑

| 尝试 | 结果 |
|---|---|
| 给 ollama.service 加 `Environment="HF_ENDPOINT=https://hf-mirror.com"` | ❌ **0.34.1 不读这个变量**，日志里 server config 无此项，仍连 huggingface.co |
| `ollama pull hf-mirror.com/AtomicChat/...`（镜像当 registry 前缀） | ❌ 被解析成 `https://ollama.hf-mirror.com/v2/...`，`tls: internal error` |
| `/api/create` 传 `{"model":..,"from":"<路径>"}` | ❌ `invalid model name` |
| `/api/create` 传 `{"name":..,"modelfile":"FROM ..."}` | ❌ `neither 'from' or 'files' was specified`（新 API 已移除 modelfile 字段） |
| `ls` blob 头 4 字节 | ✅ `GGUF` → 说明权重文件完好，可用于 FROM |
| `sudo ollama create -f Modelfile` | ✅ **成功，27 秒，零复制** |

补充：`HF_ENDPOINT` 那段配置保留在 override.conf 里（无害，未来版本可能支持），
备份在 `override.conf.bak-hfmirror`。

## 复用清单（下次遇到中断的 HF 拉取）

1. `journalctl -u ollama | grep download` 找出哪些 blob 已完成
2. 完成的 blob 直接留着，**不要删**
3. 找到主权重的 blob（通常最大那个），确认头 4 字节是 `GGUF`
4. **先查官方同名模型的 Modelfile**，抄下 `RENDERER` / `PARSER` / `PARAMETER`：
   ```bash
   ollama show <官方同名模型> --modelfile | grep -E '^(RENDERER|PARSER|PARAMETER)'
   ```
5. `sudo ollama create <名字> -f <Modelfile>`（Modelfile 里 **FROM + RENDERER + PARSER + PARAMETER 都要有**）
6. 用畸形 system 位置验证（**这一步不能省**，见上节）：
   ```bash
   curl -s http://127.0.0.1:11434/api/chat -d '{"model":"<名字>","messages":[
     {"role":"user","content":"hi"},{"role":"system","content":"be brief"},
     {"role":"user","content":"ok"}],"stream":false}' | head -c 200
   # 必须返回正常回答，不能出现 Jinja Exception
   ```
7. `ollama show <名字>` 确认架构、capabilities 与参数

## 如果要从头拉 HF 模型

直连不通时，别指望 ollama 内置下载器。可行路径：

```bash
# 用 hf CLI 走镜像下载，再本地导入
export HF_ENDPOINT=https://hf-mirror.com
pip install huggingface_hub
hf download AtomicChat/Qwen3.8-27B-GGUF Qwen3.8-27B-AD-IQ3_S.gguf --local-dir /data/models
# 然后 ollama create -f Modelfile（FROM 指向下载好的 .gguf）
```

注意 hf CLI 支持断点续传，比 ollama 内置下载器稳定得多。

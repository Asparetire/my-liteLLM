#!/usr/bin/env bash
# 部署前机器体检：跑完把输出贴回来，用于确定模型档位与并发参数
# 用法: bash check-machine.sh
# 无 root 也能跑，个别项会跳过

set -uo pipefail

BOLD='\033[1m'; DIM='\033[2m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; NC='\033[0m'
sec() { printf "\n${BOLD}== %s ==${NC}\n" "$1"; }
kv()  { printf "  %-22s %s\n" "$1" "$2"; }

sec "系统"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  kv "OS" "$PRETTY_NAME"
else
  kv "OS" "$(uname -s) $(uname -r)"
fi
kv "内核" "$(uname -r)"
kv "架构" "$(uname -m)"
kv "主机名" "$(hostname)"
kv "内网 IP" "$(hostname -I 2>/dev/null || ip -4 addr show scope global 2>/dev/null | awk '/inet /{print $2}' | tr '\n' ' ')"

sec "CPU"
kv "型号" "$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)"
kv "物理核 / 线程" "$(nproc) 线程"

sec "内存"
free -h 2>/dev/null | awk 'NR==1{printf "  %-22s %s\n","总量/已用/可用",$2" / "$3" / "$7} NR==2{printf "  %-22s %s\n","Mem 明细","总 "$2"  已用 "$3"  可用 "$7}'

sec "磁盘"
df -h -x tmpfs -x devtmpfs 2>/dev/null | awk 'NR==1{next}{printf "  %-22s %s / %s  (已用 %s, 可用 %s)\n",$6,$3,$2,$5,$4}'
if command -v lsblk >/dev/null 2>&1; then
  echo "  ${DIM}-- 块设备（SSD/NVMe 判断依据，含 ROTA=0 为固态）--${NC}"
  lsblk -d -o NAME,SIZE,TYPE,ROTA,MODEL 2>/dev/null | sed 's/^/  /'
fi

sec "GPU"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=index,name,memory.total,memory.used,driver_version,compute_cap,utilization.gpu,temperature.gpu \
    --format=csv,noheader 2>/dev/null | while IFS=, read -r i name tot used drv cc util temp; do
      printf "  ${GREEN}GPU%s${NC} %s\n" "$(echo $i|xargs)" "$(echo $name|xargs)"
      kv "  显存 (总/已用)" "$(echo $tot|xargs) / $(echo $used|xargs)"
      kv "  驱动版本" "$(echo $drv|xargs)"
      kv "  算力 (CC)" "$(echo $cc|xargs)"
      kv "  利用率 / 温度" "$(echo $util|xargs) / $(echo $temp|xargs)"
    done
  kv "驱动 + CUDA 上限" "$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1) / $(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | head -1 | cut -d' ' -f3)"
  kv "GPU 数量" "$(nvidia-smi -L 2>/dev/null | wc -l)"
  kv "型号是否一致" "$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | sort -u | wc -l) 种"
  echo "  ${DIM}-- 拓扑（是否 NVLink / 同 NUMA，多卡张量并行要看）--${NC}"
  nvidia-smi topo -m 2>/dev/null | sed 's/^/  /' | head -20
else
  echo "  ${RED}未检测到 nvidia-smi${NC} —— 驱动未装，或这是无 GPU 的机器"
fi

sec "Docker / 容器运行时"
if command -v docker >/dev/null 2>&1; then
  kv "Docker 版本" "$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '已安装但守护进程未运行/无权限')"
  kv "Compose" "$(docker compose version --short 2>/dev/null || echo '未安装')"
  if docker info >/dev/null 2>&1; then
    kv "默认运行时" "$(docker info --format '{{.DefaultRuntime}}' 2>/dev/null)"
    RUNTIMES=$(docker info --format '{{range .Runtimes}}{{.}} {{end}}' 2>/dev/null)
    kv "可用运行时" "$RUNTIMES"
    if echo "$RUNTIMES" | grep -q nvidia; then
      echo "  ${GREEN}✓ nvidia 运行时已就绪，容器可用 GPU${NC}"
    else
      echo "  ${YELLOW}! 未找到 nvidia 运行时${NC} —— 需安装 nvidia-container-toolkit，否则 Docker 里看不到 GPU"
    fi
  fi
else
  echo "  ${YELLOW}! Docker 未安装${NC}"
fi

sec "网络（决定能否在线拉模型）"
if curl -s -m 5 -o /dev/null -w '%{http_code}' https://registry.ollama.ai 2>/dev/null | grep -q 200; then
  echo "  ${GREEN}✓ 可访问 ollama.com（能直接 ollama pull）${NC}"
else
  echo "  ${YELLOW}! 无法访问 ollama.com${NC} —— 需离线导入 GGUF，或改用 ModelScope 镜像"
fi
if curl -s -m 5 -o /dev/null -w '%{http_code}' https://www.modelscope.cn 2>/dev/null | grep -q 200; then
  echo "  ${GREEN}✓ 可访问 ModelScope${NC}"
else
  echo "  ${DIM}  ModelScope 不可达（仅影响备选下载源）${NC}"
fi

sec "显存档位 → 模型建议（Q4_K_M 量化估算）"
python3 - <<'PY' 2>/dev/null || awk 'BEGIN{print "  (python3 不可用，跳过自动估算)"}'
import subprocess, shutil
def sh(c):
    try: return subprocess.check_output(c, shell=True, text=True).strip()
    except Exception: return ""
tot = sh("nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits")
if not tot:
    print("  未检测到 GPU，无法估算"); raise SystemExit
gpus = [float(x) for x in tot.split("\n") if x.strip()]
n, single = len(gpus), min(gpus)
usable = single * 0.75 if n == 1 else sum(gpus) * 0.70
print(f"  GPU 数量: {n}   单卡显存: {single:.0f} GB   可用于权重的预算: {usable:.0f} GB")
print(f"  {'-'*58}")
tiers = [
    (3,   "qwen3:1.7b / qwen3:0.6b", "仅适合测试和嵌入场景"),
    (6,   "qwen3:4b", "轻量助手、RAG 摘要"),
    (11,  "qwen3:8b", "8-16GB 卡的主力，中文对话够用"),
    (17,  "qwen3:14b", "质量明显提升，推荐起点"),
    (24,  "qwen3:32b / qwen3:30b-a3b (MoE)", "24GB 卡的甜点位"),
    (40,  "qwen3:32b 高量化档 (q5/q6)", "长上下文 + 并发"),
    (999, "qwen3:32b FP8 / 更大 MoE / 多卡 TP", "生产级，可多模型常驻"),
]
for cap, name, note in tiers:
    if usable <= cap:
        print(f"  >> 建议: {name}")
        print(f"     {note}")
        break
print(f"\n  估算公式: 权重(GB) ≈ 参数量(B) × 0.6 (Q4_K_M)")
print(f"  硬约束: 权重 ≤ 显存 × 0.75，其余留给 KV cache 与并发")
print(f"  最终以 'ollama ps' 的实际占用为准")
PY

sec "下一步"
cat <<'TXT'
  1. 把上面输出（尤其 GPU / 显存 / Docker 运行时 三块）贴回来
  2. 若 "nvidia 运行时已就绪" 未出现，先装 nvidia-container-toolkit
  3. 若网络不通，改用 ModelScope 下载 GGUF 后离线导入
TXT
echo

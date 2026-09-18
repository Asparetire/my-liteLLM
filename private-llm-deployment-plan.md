# 私有化开源大模型部署实施方案

适用范围：单台物理服务器（NVIDIA GPU），内网私有环境，对内部人员提供稳定推理服务。

文档版本：v1.0，编制日期 2026-09-15。版本信息以各组件官方发布为准，安装前请复核第 8 节。

---

## 0. 需要你提前确认的信息

以下信息会直接改变选型结论，建议在动手前确认。若暂时无法提供，文档已按常见档位给出分支方案，你可在对应章节对号入座。

| 编号 | 待确认项 | 影响哪些决策 | 没有它时的默认假设 |
|---|---|---|---|
| Q1 | GPU 型号、单卡显存、卡数 | 模型参数规模、量化方案、并行策略 | 按 24GB 单卡规划，第 4 节提供全档位对照 |
| Q2 | 是否所有卡同型号 | 能否用张量并行（不同型号只能流水线并行） | 默认同型号 |
| Q3 | CPU 核数、系统内存容量 | 并发上限、模型加载期的内存压力 | 默认 32 核 / 128GB |
| Q4 | 磁盘：系统盘容量与介质、是否有独立数据盘（NVMe 优先）、总可用空间 | 分区方案、能放几个模型 | 默认 480GB SSD 系统盘 + 2TB NVMe 数据盘 |
| Q5 | 服务器能否访问外网（完全隔离 / 仅内网 / 可出网） | 模型获取方式、驱动与镜像安装方式 | 默认完全隔离，全部走离线介质导入 |
| Q6 | 是否有内网 apt 源、Docker 镜像仓库、PyPI 源 | 安装效率与可维护性 | 默认无，全部手工导入 |
| Q7 | 主要用途：对话问答 / 代码辅助 / 知识库 RAG / 复杂推理 / 多模态 | 模型选型、上下文长度、是否需要推理型模型 | 默认中文对话为主 + 少量代码 |
| Q8 | 使用人数、峰值并发请求数、平均输入与输出 token 数 | 并发参数、显存中 KV cache 的预留比例 | 默认 50 人以内，峰值 20 并发 |
| Q9 | 是否需要按人/按部门计量与限额 | 是否必须部署 LiteLLM 网关层 | 默认需要 |
| Q10 | 是否已有 K8s 集群，或只允许裸机 Docker | 部署形态（Docker Compose / Helm） | 默认裸机 Docker Compose |
| Q11 | 合规要求：日志留存周期、审计、是否需对接企业 SSO | 日志方案、UI 鉴权方式 | 默认内网可信，日志留存 90 天 |
| Q12 | 服务器 IP、内网域名、可用端口范围 | 端口规划与反代配置 | 默认使用 4000 / 8000 / 3000 / 5432 / 6379 |
| Q13 | 运维接入方式：跳板机 / VPN / 直连 | SSH 加固策略 | 默认经跳板机 |
| Q14 | 电力与散热条件、是否有 UPS | 是否需要降功耗、限频 | 默认机房标准环境 |

---

## 1. 总体架构

### 1.1 分层结构

```
┌─────────────────────────────────────────────────────────┐
│ 访问层    内网 DNS / Nginx 反代 / Open WebUI / 业务系统    │
├─────────────────────────────────────────────────────────┤
│ 网关层    LiteLLM :4000                                  │
│           虚拟 key、预算与限流、用量计量、审计、Admin UI    │
│           依赖 Redis(计数) + Postgres(持久化)              │
├─────────────────────────────────────────────────────────┤
│ 推理层    vLLM :8000                                     │
│           PagedAttention、连续批处理、张量并行            │
│           OpenAI 兼容 API，模型权重只读挂载               │
├─────────────────────────────────────────────────────────┤
│ 运行时层  NVIDIA 驱动 + CUDA + nvidia-container-toolkit    │
│           Docker Engine                                  │
├─────────────────────────────────────────────────────────┤
│ 系统层    Ubuntu Server 24.04 LTS + NVIDIA GPU + 数据盘    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 为什么分两层（vLLM + LiteLLM）

vLLM 负责把模型跑快，自带 OpenAI 兼容接口，但它没有用户体系、配额和审计能力。LiteLLM 负责把这套接口包装成可运营的服务：发虚拟 key、限流、算钱、记日志。两者都是 OpenAI 格式，对接只需要在配置里写一行 `api_base`。

如果只需要给一两个人用、不做计量，第 5 节的网关层可以跳过，直接暴露 vLLM。

### 1.3 组件清单与端口

| 组件 | 端口 | 部署方式 | 说明 |
|---|---|---|---|
| vLLM | 8000 | Docker | 推理服务，只监听内网 |
| LiteLLM | 4000 | Docker | 网关与 Admin UI |
| Postgres | 5432 | Docker | key、团队、花费日志 |
| Redis | 6379 | Docker | 限流计数、预算预扣、缓存 |
| Open WebUI（可选） | 3000 | Docker | 给非技术同事的聊天界面 |
| Nginx（可选） | 80/443 | 宿主机 | 统一入口与域名 |
| Prometheus（可选） | 9090 | Docker | 指标采集 |

---

## 2. 阶段一：操作系统安装与加固

### 2.1 目标

装好一个最小化、可远程维护、可复现的 Linux 系统，并完成基础安全加固。

### 2.2 发行版选型

| 选项 | 结论 | 理由 |
|---|---|---|
| Ubuntu Server 24.04 LTS | 推荐 | NVIDIA 官方 apt 仓库直接支持，驱动与容器工具链更新最快，社区资料最多。支持周期到 2029 年 |
| Ubuntu Server 26.04 LTS | 可选 | 更新，GCC 15 与新版 CUDA 配合更好，但服务器场景资料相对少 |
| Rocky Linux 9 / AlmaLinux 9 | 可选 | 若公司有 RHEL 生态合规要求。注意驱动安装走 RPM 仓库，命令与本文不同 |
| CentOS 7 | 不推荐 | 已停止维护 |
| Windows Server | 不推荐 | GPU 推理生态在 Windows 上支持不完整 |

内核选择：Ubuntu 24.04 默认内核即可。不要手动安装主线最新内核，GPU 驱动的 DKMS 编译依赖内核头文件，内核越新越容易遇到驱动编译失败。

### 2.3 安装要点

**步骤 1：制作安装介质并校验**

```bash
# 在能上网的机器上获取镜像，务必校验校验和
# Ubuntu 24.04 LTS Server 镜像从 releases.ubuntu.com 获取
sha256sum ubuntu-24.04.x-live-server-amd64.iso
```

目标：镜像完整，避免安装中途出现莫名其妙的包错误。

成功标准：校验和与官网公布值一致。

**步骤 2：BIOS 设置**

- 开启 UEFI 模式（不要用 Legacy/CSM）
- 关闭 Secure Boot（或保留开启但准备好 MOK 注册密码，见阶段二常见问题）
- 若主板支持，开启 Above 4G Decoding 与 Resizable BAR，多卡环境必须开启
- 关闭 CPU 深度节能（C-State 过深会影响推理延迟），在 BIOS 里设为 Performance 或 C1E 关闭

成功标准：`lspci | grep -i nvidia` 能看到全部 GPU 设备。

**步骤 3：安装过程**

- 语言选 English（避免中文路径与日志编码问题，locale 设 `en_US.UTF-8`）
- 安装类型选 Ubuntu Server (minimized)
- **不要勾选安装第三方驱动与附加驱动**，驱动统一在阶段二手工安装，避免版本不可控
- 网络配置：静态 IP（服务器必须用静态地址）
- 创建普通用户（如 `ops`），不要直接用 root 登录

成功标准：首次登录进入 shell，`ip a` 显示配置的静态 IP。

### 2.4 分区方案

假设 480GB 系统盘 + 2TB 数据盘。使用 LVM 方便后续扩容。

| 挂载点 | 建议容量 | 文件系统 | 说明 |
|---|---|---|---|
| `/boot/efi` | 1GB | FAT32 | UEFI 分区 |
| `/boot` | 2GB | ext4 | 内核更新需要，不要小于 1GB |
| `/` | 100GB | ext4/xfs | 系统与 Docker 默认目录 |
| `/var/lib/docker` | 剩余系统盘全部 | xfs（推荐，配合 overlay2 需 `ftype=1`） | 镜像与容器层，vLLM 镜像约 10-20GB |
| swap | 32-64GB | - | 模型加载与内存峰值时的缓冲，不要设为 0 |
| `/data` | 数据盘全部 | xfs/ext4 | 模型权重、Postgres 数据、备份 |

要点：

- 用 LVM，给 `/` 和 `/var/lib/docker` 留扩容空间
- xfs 格式化时确认 `ftype=1`，否则 overlay2 无法工作：`xfs_info / | grep ftype`
- **模型权重必须放在独立大容量分区**，一个 32B 模型 BF16 权重约 64GB，INT4 约 18GB，多模型并存很容易吃掉几百 GB
- `/data` 挂载时加 `noatime` 减少无谓写入

示例（数据盘为 `/dev/nvme0n1`）：

```bash
sudo mkfs.xfs -f /dev/nvme0n1
sudo mkdir -p /data
UUID=$(sudo blkid -s UUID -o value /dev/nvme0n1)
echo "UUID=$UUID /data xfs defaults,noatime 0 2" | sudo tee -a /etc/fstab
sudo mount -a
df -h /data
```

成功标准：`df -h` 能看到 `/data` 正确挂载，`touch /data/test && rm /data/test` 成功。

### 2.5 远程登录与基础安全加固

**目标**：只允许密钥登录，禁用 root 远程登录，最小化暴露面。

```bash
# 1. 在管理员本机生成密钥（不是服务器上）
ssh-keygen -t ed25519 -C "ops@company" -f ~/.ssh/id_ed25519_litellm_host
# 2. 传公钥到服务器
ssh-copy-id -i ~/.ssh/id_ed25519_litellm_host.pub ops@<服务器IP>
```

确认密钥能登录后，再修改服务端配置：

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers ops
EOF

sudo sshd -t && sudo systemctl restart ssh
```

**注意**：执行前务必保持一个已登录的会话不断开，另外开一个终端验证密钥登录成功，否则可能把自己锁在外面。

其他加固项：

```bash
# 防火墙：只放行必要端口，内网 IP 段按需调整
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp comment 'ssh from intranet'
sudo ufw allow from 10.0.0.0/8 to any port 4000 proto tcp comment 'litellm'
sudo ufw allow from 10.0.0.0/8 to any port 3000 proto tcp comment 'webui'
sudo ufw allow from 10.0.0.0/8 to any port 9090 proto tcp comment 'prometheus'
sudo ufw enable
sudo ufw status verbose

# 时间同步（日志排查和证书校验都依赖时间正确）
sudo timedatectl set-timezone Asia/Shanghai
sudo apt install -y chrony
# 内网无外网时，指向内网 NTP 服务器
sudo sed -i 's/^pool .*/server <内网NTP服务器IP> iburst/' /etc/chrony/chrony.conf
sudo systemctl enable --now chrony
chronyc sources -v

# 自动安全更新
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**注意**：自动更新涉及内核升级时会导致 NVIDIA 驱动 DKMS 重新编译。生产环境建议把内核包加入 apt 黑名单，改为人工窗口升级：

```bash
sudo apt-mark hold linux-image-generic linux-headers-generic
```

成功标准：

- `ssh -o PreferredAuthentications=password ops@<IP>` 应被拒绝
- `sudo ufw status` 显示规则生效且默认拒绝入站
- `chronyc tracking` 显示已同步
- `sudo -l -U ops` 显示 ops 具备 sudo 权限

### 2.6 阶段一常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 安装程序找不到磁盘 | 服务器 RAID/SAS 卡驱动缺失 | 在 BIOS 配置为 AHCI 或加载厂商驱动；Dell/HP 服务器可用官方 ISO |
| `lspci` 看不到 GPU | Above 4G Decoding 未开，或 GPU 未插好 | 进 BIOS 开启 Above 4G Decoding；检查 GPU 供电 |
| 改完 sshd 配置连不上 | 配置语法错误或密钥未生效 | 用服务器本地控制台（IPMI/iDRAC/iLO）登录修复，永远先 `sshd -t` 再 reload |
| `apt update` 失败 | 内网不通 | 配置内网镜像源，或用 `apt-offline` 从外网机导出包 |
| 系统日志报 `No space left on device` | `/boot` 太小，旧内核堆积 | 清理旧内核 `sudo apt autoremove --purge`，长期方案是安装时把 `/boot` 给 2GB |

---

## 3. 阶段二：GPU 驱动、CUDA 与容器运行时

### 3.1 目标

让宿主机正确识别 GPU，CUDA 程序可以运行，Docker 容器可以访问 GPU。

### 3.2 版本匹配原则

这是整个部署中最容易出错的地方。三条规则：

1. **驱动版本决定 CUDA 上限**。CUDA 13.x 要求 R580 或更新的驱动分支。驱动可以比 CUDA 要求的新（向后兼容），不能旧。
2. **CUDA Toolkit 与驱动分支的对应关系**（截至 2026 年）：

| CUDA Toolkit | 对应驱动分支 |
|---|---|
| 13.0 | R580 |
| 13.2 | R595 |
| 13.3 | R610 |
| 13.4 | R615 |

3. **CUDA 13.0 起移除了计算能力 7.5（Turing）之前架构的离线编译支持**。若 GPU 是 Maxwell/Pascal/Volta（如 P100、V100 属于 Volta，CC 7.0），继续使用 CUDA 12.9 与 R580 驱动。

**驱动分支生命周期**，选 LTS 分支更省心：

| 分支 | 类型 | 生命周期 |
|---|---|---|
| R535 | LTS | 已于 2026-06 EOL，新部署不要选 |
| R580 | LTS | 支持到 2028 年中，新部署首选 |
| R595 | Production | 2027-03 |
| R610 | New Feature | 2026-08，不适合生产 |

### 3.3 推荐组合

| 场景 | 驱动 | CUDA | vLLM 镜像 | 说明 |
|---|---|---|---|---|
| 通用（推荐） | R580（nvidia-open） | 12.9 | `vllm/vllm-openai:v0.29.0` | 兼容性最广，vLLM 默认 wheel 即 CUDA 12.9 |
| Hopper/Blackwell（H100/H200/B200） | R580 或 R595 | 13.0 | 同上，选 cu130 wheel 或 NGC 镜像 | 新架构在新 CUDA 上内核更优 |
| 老卡（V100 及更早） | R580 | 12.9 | 同上 | 不要上 CUDA 13 |

**vLLM 版本**：撰写本文时官方 stable 为 0.29.0。生产环境**必须固定具体 tag**，不要用 `latest`，否则某次重启后版本跳变会导致不可预期的问题。

**验证最新版本的命令**（在有网机器上执行后记录结果）：

```bash
curl -s https://api.github.com/repos/vllm-project/vllm/releases/latest | grep tag_name
```

### 3.4 安装步骤

**步骤 1：准备编译环境**

```bash
sudo apt update
sudo apt install -y build-essential linux-headers-$(uname -r) dkms curl wget gnupg2 ca-certificates
```

目标：DKMS 编译驱动模块需要内核头文件，版本必须与运行内核一致。

**步骤 2：添加 NVIDIA 官方仓库**

```bash
distro=$(. /etc/os-release && echo "ubuntu${VERSION_ID/./}")
echo $distro    # 应输出 ubuntu2404

wget https://developer.download.nvidia.com/compute/cuda/repos/${distro}/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update
```

完全离网环境：在能上网的同构机器上下载好 `.deb` 与依赖，用 `apt-offline` 或手工 `dpkg -i` 导入。

**步骤 3：安装驱动**

Turing 及更新架构（GTX 16 系、RTX 20/30/40/50 系、A 系列、H 系列）使用开源内核模块：

```bash
sudo apt install -y nvidia-open
```

Maxwell/Pascal/Volta 使用专有模块：

```bash
sudo apt install -y cuda-drivers
```

两者只能装一个。

**关于 Secure Boot**：若 BIOS 开启了 Secure Boot，DKMS 编译的模块需要签名并在首次重启时完成 MOK 注册。安装过程中会提示设置密码，重启后出现蓝色 MOK 界面，选择 Enroll MOK 并输入该密码。若不想处理，进 BIOS 关闭 Secure Boot。检查状态：`mokutil --sb-state`。

```bash
sudo reboot
```

**步骤 4：安装 CUDA Toolkit**

```bash
sudo apt install -y cuda-toolkit-12-9
echo 'export PATH=/usr/local/cuda/bin:$PATH' | sudo tee /etc/profile.d/cuda.sh
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' | sudo tee -a /etc/profile.d/cuda.sh
source /etc/profile.d/cuda.sh
```

**步骤 5：安装 Docker 与 NVIDIA 容器工具包**

```bash
# Docker Engine
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

**步骤 6：把 Docker 数据目录迁到大分区**

```bash
sudo systemctl stop docker
sudo mkdir -p /var/lib/docker
# 若 /var/lib/docker 已挂载独立分区可跳过；否则 rsync 到数据盘后 bind mount
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "data-root": "/var/lib/docker",
  "runtimes": {
    "nvidia": {
      "path": "nvidia-container-runtime",
      "runtimeArgs": []
    }
  },
  "default-runtime": "nvidia",
  "log-driver": "json-file",
  "log-opts": { "max-size": "100m", "max-file": "5" },
  "live-restore": true
}
EOF
sudo systemctl start docker
```

`live-restore: true` 让 Docker 守护进程重启时不杀掉容器，对推理服务很重要。

把运维用户加入 docker 组：`sudo usermod -aG docker ops`，然后重新登录。

### 3.5 阶段二验证

```bash
# 1. 驱动与 GPU 状态
nvidia-smi
# 期望：列出全部 GPU，显示驱动版本与 CUDA Version，无 ERROR

# 2. 确认使用的是开源内核模块（Turing+ 场景）
cat /proc/driver/nvidia/version | grep -i open

# 3. GPU 拓扑（多卡时看互联方式）
nvidia-smi topo -m
# 期望：同节点多卡之间显示 NVLink 或 PIX/PXB，而不是 SYS

# 4. CUDA 编译器
nvcc --version

# 5. 容器内能否看到 GPU（这是最关键的一步）
docker run --rm --gpus all nvidia/cuda:12.9.0-base-ubuntu24.04 nvidia-smi
# 期望：容器内输出与宿主机一致的 GPU 列表

# 6. 持续观察（另开终端，压测时看功耗与显存）
nvidia-smi dmon
```

成功标准：第 1、5 步都能看到完整 GPU 列表且无报错，第 3 步多卡互联正常。

### 3.6 阶段二常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `nvidia-smi` 报 `NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver` | 驱动模块未加载，多为 DKMS 编译失败或 Secure Boot 未注册 MOK | `dkms status` 看状态；`sudo dkms autoinstall`；检查 `mokutil --sb-state` |
| `dkms` 报内核头文件缺失 | 头文件版本与内核不一致 | `sudo apt install linux-headers-$(uname -r)`，确认 `uname -r` 与已安装头文件一致 |
| 容器内看不到 GPU | nvidia-container-toolkit 未配置或 daemon.json 被覆盖 | 重跑 `nvidia-ctk runtime configure --runtime=docker` 并重启 docker；检查 daemon.json 是否被 `nvidia-ctk` 改写 |
| 程序报 `CUDA driver version is insufficient for CUDA runtime version` | 驱动太旧 | 升级驱动到 CUDA 对应分支（见 3.2 表） |
| 老卡（V100）装完 CUDA 13 后无法编译 | CUDA 13 移除 pre-Turing 支持 | 退回 CUDA 12.9 + R580 驱动 |
| GPU 之间显示 SYS 互联 | 跨 CPU 插槽，PCIe 走 QPI/UPI | 多卡 TP 性能会明显下降，尽量把卡插在同一 PCIe Root Complex 下，或改用流水线并行 |
| `nvidia-smi` 显示 `ERR!` 或掉卡 | 供电不足或温度过高 | 检查 GPU 供电线与机箱散热，`nvidia-smi -q -d TEMPERATURE,POWER` |

---

## 4. 阶段三：模型选型

### 4.1 显存估算方法

权重显存 = 参数量（B）× 每个参数字节数：

| 精度 | 字节/参数 | 32B 模型权重 | 70B 模型权重 |
|---|---|---|---|
| BF16 / FP16 | 2 | 64GB | 140GB |
| FP8 | 1 | 32GB | 70GB |
| INT4（GPTQ/AWQ） | 0.5 | 16-18GB | 35-43GB |

实际占用还要加上三部分：

1. **KV cache**：随并发数与上下文长度线性增长。vLLM 用 `--gpu-memory-utilization` 控制总占用比例，剩余空间才给 KV cache
2. **激活值与临时缓冲**：约 1-2GB
3. **CUDA context**：约 0.5GB/卡

工程经验：**权重占用不要超过单卡显存的 80%**，剩下的留给 KV cache。上下文开得越长，留给并发的空间越少。若需要 128K 长上下文，模型权重占比应降到 60-70%。

公式：

```
可用 KV cache = 单卡显存 × gpu_memory_utilization - 权重大小 - 激活 - CUDA context
```

### 4.2 按显存分档的选型建议

| 单卡显存 | 可稳定运行 | 量化方案 | 说明 |
|---|---|---|---|
| 8-12GB | Qwen3-8B、GLM-4-9B | INT4 / AWQ | 只适合小范围试用，并发能力有限 |
| 16GB | Qwen3-14B | INT4 | 32B 只能在极短上下文下勉强跑，不推荐 |
| 24GB | Qwen3-30B-A3B（MoE）、Qwen3-32B、DeepSeek-R1-Distill-Qwen-32B | INT4（约 17-18GB） | 单卡性价比最高的档位，中文场景首选 |
| 48GB | Qwen3-32B BF16、70B 级 INT4 | BF16 或 INT4 | 可兼顾质量与并发 |
| 80GB（A100/H100） | Qwen3-32B BF16 高并發、70B INT4、小尺寸 MoE | FP8（H 系列）/ BF16 | 生产首选档位 |
| 多卡（4×80GB 及以上） | GLM-5 系列、DeepSeek 系列、Qwen3-235B-A22B | FP8 + 张量并行 | MoE 旗舰需要专家并行，显存门槛高 |

### 4.3 中文场景的选型建议

| 用途 | 首选 | 备选 | 说明 |
|---|---|---|---|
| 通用中文对话 | Qwen3 系列（8B/14B/32B） | GLM-4 系列 | 中文语料充分，指令跟随稳定，Apache 2.0 许可 |
| 代码辅助 | Qwen3-Coder、Devstral Small 2 24B | DeepSeek-Coder | 单卡 24GB 可跑 24B 代码模型 |
| 复杂推理 | DeepSeek-R1-Distill-Qwen-32B | Qwen3 推理增强版 | 需要更长输出，注意 KV cache 预留 |
| Agent / 工具调用 | GLM-4-9B（小模型里结构化输出最稳） | Qwen3-14B | 小参数模型做工具调用时优先看这个 |
| 知识库 RAG | Qwen3-14B/32B | GLM-4 | 中文长文档理解好 |
| 多模态 | Qwen3-VL 系列 | GLM-4V | 需确认 vLLM 对该视觉模型的支持版本 |

**许可证提示**：优先选 Apache 2.0（Qwen 系列、Mistral）或 MIT（DeepSeek、GLM）许可的模型，商业化使用限制最少。部分"开放权重"模型的商用条款可能未明确，部署前务必确认。

### 4.4 量化方案选择

| 格式 | 适用框架 | 特点 | 建议 |
|---|---|---|---|
| BF16/FP16 | 全部 | 无精度损失，显存占用最大 | 显存充裕时的首选 |
| FP8 | vLLM | 精度损失极小，吞吐提升明显 | 生产环境首选（需 Ada/Hopper 及以上架构） |
| AWQ | vLLM | 4bit，激活感知量化，质量优于 GPTQ | vLLM 生态推荐 |
| GPTQ | vLLM | 4bit，生态成熟 | 与 AWQ 二选一即可 |
| GGUF Q4_K_M | Ollama / llama.cpp | 个人与 CPU 场景 | 服务端不用，除非走 llama.cpp |

结论：**服务端 vLLM 优先用 BF16（显存够）或 FP8/AWQ（显存紧张）**，不要用 GGUF。

### 4.5 模型获取

内网环境通常无法直连 HuggingFace。三种方式：

**方式 A：有可出网的跳板机，用 ModelScope（国内速度快）**

```bash
pip install modelscope
modelscope download --model qwen/Qwen3-32B --local_dir /data/models/Qwen3-32B
```

**方式 B：HuggingFace 官方工具**

```bash
pip install -U "huggingface_hub[cli]"
export HF_ENDPOINT=https://hf-mirror.com   # 国内镜像，按需
huggingface-cli download Qwen/Qwen3-32B --local-dir /data/models/Qwen3-32B
```

**方式 C：完全离网**

在有网机器下载后，用移动硬盘或内网 rsync 拷入：

```bash
rsync -avP /path/to/Qwen3-32B/ ops@<服务器IP>:/data/models/Qwen3-32B/
```

**要点**：

- 下载后核对文件完整性与大小，`safetensors` 文件缺失会导致加载时报奇怪的错误
- 建议同时保存模型的 `config.json`、`tokenizer` 相关文件与 `generation_config.json`，缺一不可
- 目录规范统一为 `/data/models/<模型名>`，容器内以只读方式挂载到 `/models`

成功标准：

```bash
ls -lh /data/models/Qwen3-32B | head -20
# 应看到 *.safetensors、config.json、tokenizer.json、generation_config.json 等
du -sh /data/models/Qwen3-32B
# 大小应与预期接近（32B INT4 约 18GB，BF16 约 64GB）
```

---

## 5. 阶段四：推理服务部署（vLLM）

### 5.1 目标

用容器方式启动 vLLM，提供 OpenAI 兼容的推理接口。

### 5.2 单卡启动

```bash
docker run -d \
  --name vllm \
  --gpus '"device=0"' \
  --ipc=host \
  --shm-size=16g \
  -v /data/models:/models:ro \
  -p 8000:8000 \
  --restart unless-stopped \
  vllm/vllm-openai:v0.29.0 \
  --model /models/Qwen3-32B \
  --served-model-name qwen3-32b \
  --gpu-memory-utilization 0.90 \
  --max-model-len 32768 \
  --max-num-seqs 32 \
  --enable-prefix-caching \
  --api-key <自定义一个内部key> \
  --host 0.0.0.0 \
  --port 8000
```

### 5.3 多卡启动（张量并行）

```bash
docker run -d \
  --name vllm \
  --gpus all \
  --ipc=host \
  --shm-size=32g \
  -v /data/models:/models:ro \
  -p 8000:8000 \
  --restart unless-stopped \
  vllm/vllm-openai:v0.29.0 \
  --model /models/Qwen3-32B \
  --served-model-name qwen3-32b \
  --tensor-parallel-size 4 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 32768 \
  --max-num-seqs 64 \
  --enable-prefix-caching \
  --enable-chunked-prefill \
  --api-key <自定义一个内部key> \
  --host 0.0.0.0 \
  --port 8000
```

### 5.4 关键参数说明

| 参数 | 建议值 | 说明 |
|---|---|---|
| `--tensor-parallel-size` | 单卡 1，多卡等于卡数 | 同节点多卡用 TP。不同型号混插时改用 `--pipeline-parallel-size` |
| `--gpu-memory-utilization` | 0.85-0.92 | 控制 vLLM 占用显存比例。太高容易 OOM，太低 KV cache 不足影响并发。同机有其他进程时降到 0.8 |
| `--max-model-len` | 按业务定，常用 8K/32K | 决定单个请求最大上下文。设太大 KV cache 单请求占用高，并发下降 |
| `--max-num-seqs` | 16-256 | 最大并发序列数。是吞吐与显存的平衡点，需压测确定 |
| `--enable-prefix-caching` | 建议开 | 相同前缀（如系统提示词）复用 KV cache，对固定提示词场景提升明显 |
| `--enable-chunked-prefill` | 长输入建议开 | 降低长文本的首 token 延迟 |
| `--ipc=host` / `--shm-size` | 多卡必需 | 否则 NCCL 走 socket，多卡通信极慢或直接崩 |
| `--api-key` | 必设 | vLLM 本身的访问令牌，避免裸奔 |
| `--served-model-name` | 自定义 | 对外暴露的模型名，与目录解耦，便于后续换模型不改调用方 |

### 5.5 用 Docker Compose 托管（推荐）

创建 `/data/deploy/docker-compose.yml`：

```yaml
services:
  vllm:
    image: vllm/vllm-openai:v0.29.0
    container_name: vllm
    restart: unless-stopped
    ipc: host
    volumes:
      - /data/models:/models:ro
    ports:
      - "8000:8000"
    command: >
      --model /models/Qwen3-32B
      --served-model-name qwen3-32b
      --tensor-parallel-size 1
      --gpu-memory-utilization 0.90
      --max-model-len 32768
      --max-num-seqs 32
      --enable-prefix-caching
      --api-key ${VLLM_API_KEY}
      --host 0.0.0.0
      --port 8000
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 300s
```

`start_period` 要给足，大模型加载通常需要 1-5 分钟。

### 5.6 阶段四验证

```bash
# 1. 看启动日志，确认加载进度
docker logs -f vllm
# 期望看到：模型加载进度、KV cache 大小、"Uvicorn running on http://0.0.0.0:8000"

# 2. 健康检查
curl http://localhost:8000/health
# 期望：HTTP 200

# 3. 列出模型
curl -H "Authorization: Bearer <VLLM_API_KEY>" http://localhost:8000/v1/models

# 4. 实际推理
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer <VLLM_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-32b",
    "messages": [{"role":"user","content":"用一句话介绍你自己"}],
    "max_tokens": 128
  }'
# 期望：返回结构化的 choices[0].message.content

# 5. 显存占用
nvidia-smi
# 期望：显存占用接近 gpu-memory-utilization 设定值，说明 KV cache 已分配

# 6. 吞吐压测（vLLM 自带基准工具）
docker exec -it vllm python3 -m vllm.entrypoints.openai.benchmark_serving 2>/dev/null || true
# 或用简单并发测试脚本，观察 TTFT 与 tokens/s
```

成功标准：第 2、3、4 步全部通过，且 `nvidia-smi` 显示显存被正常占用。

### 5.7 阶段四常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动时 OOM | `gpu-memory-utilization` 过高，或权重本身放不下 | 降到 0.85；减小 `--max-model-len`；换量化版本 |
| 报 `The model's max seq len is larger than the maximum number of tokens that can be stored in KV cache` | 上下文开太大 | 降低 `--max-model-len` 或提高 `--gpu-memory-utilization` |
| 多卡时卡在初始化 | NCCL 通信失败 | 确认 `--ipc=host` 与 `--shm-size`；`NCCL_DEBUG=INFO` 看日志；检查卡间是否 NVLink/同 Root Complex |
| 混插不同型号卡报内存相关错误 | TP 要求各卡显存切片一致 | 改用流水线并行，或只用同型号卡组 TP |
| 首 token 很慢 | prefill 阶段长 | 开 `--enable-chunked-prefill`；检查输入是否过长 |
| 并发上去后吞吐不涨 | `max-num-seqs` 太小，或 KV cache 不足 | 调大 `max-num-seqs`，观察 `nvidia-smi` 显存是否打满 |
| 模型加载报 safetensors 错误 | 下载文件损坏或不完整 | 重新下载，核对文件大小 |
| 容器启动后立刻退出 | 命令参数错误或模型路径不对 | `docker logs vllm` 看首屏报错，多半是路径或参数拼写 |

---

## 6. 阶段五：网关、Web 访问、鉴权与并发配置

### 6.1 目标

在 vLLM 之上加一层可控的 API 网关，实现按人发 key、限流、计量与审计，并提供 Web 界面。

### 6.2 部署 LiteLLM 网关

创建 `/data/deploy/litellm_config.yaml`：

```yaml
model_list:
  - model_name: qwen3-32b
    litellm_params:
      model: openai/qwen3-32b
      api_base: http://vllm:8000/v1
      api_key: os.environ/VLLM_API_KEY
      max_tokens: 8192
      timeout: 600
  - model_name: qwen3-8b
    litellm_params:
      model: openai/qwen3-8b
      api_base: http://vllm-small:8000/v1
      api_key: os.environ/VLLM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  store_model_in_db: true
  allow_requests_on_db_unavailable: false
```

要点：

- `model: openai/<名字>` 表示走 OpenAI 兼容协议，vLLM 原生支持
- `api_base` 用容器名，同一 Docker 网络内可直接解析
- 密钥一律用 `os.environ/XXX` 引用，不写明文

在同一 compose 文件里补充网关与依赖：

```yaml
  litellm:
    image: ghcr.io/berriai/litellm:main-stable
    container_name: litellm
    restart: unless-stopped
    depends_on:
      - db
      - redis
    volumes:
      - /data/deploy/litellm_config.yaml:/app/config.yaml:ro
    ports:
      - "4000:4000"
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY}
      DATABASE_URL: postgresql://llmproxy:${PG_PASSWORD}@db:5432/litellm
      REDIS_HOST: redis
      REDIS_PORT: 6379
      VLLM_API_KEY: ${VLLM_API_KEY}
    command: ["--config=/app/config.yaml", "--port", "4000"]
    healthcheck:
      test: ["CMD-SHELL", "python3 -c \"import urllib.request; urllib.request.urlopen('http://localhost:4000/health/liveliness')\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:16
    container_name: litellm_db
    restart: always
    environment:
      POSTGRES_DB: litellm
      POSTGRES_USER: llmproxy
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d litellm -U llmproxy"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    container_name: litellm_redis
    restart: always
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "2gb", "--maxmemory-policy", "noeviction"]
    volumes:
      - /data/redis:/data
```

**Redis 必须开 AOF 且不用 allkeys 淘汰策略**：限流计数与预算预扣都在这里，被淘汰会导致计数失真。

### 6.3 发放虚拟 key

```bash
curl -X POST http://<服务器IP>:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "zhangsan",
    "team_id": "engineering",
    "models": ["qwen3-32b"],
    "max_budget": 500,
    "budget_duration": "30d",
    "tpm_limit": 200000,
    "rpm_limit": 60,
    "max_parallel_requests": 8,
    "metadata": {"department": "engineering"}
  }'
```

本地模型不产生真实费用，但预算机制仍然有用：它等价于配额封顶，防止单个用户把 GPU 占满。

### 6.4 Web 访问

| 方式 | 适用 | 说明 |
|---|---|---|
| LiteLLM Admin UI | 管理员 | 访问 `http://<IP>:4000/ui`，用 master key 登录，可发 key、看用量 |
| Open WebUI | 普通用户聊天 | 独立容器，`OPENAI_API_BASE_URL` 指向 LiteLLM 的 4000，每人用自己的虚拟 key |
| 业务系统 | 程序调用 | 用 OpenAI SDK，`base_url` 指向 `http://<IP>:4000/v1` |

Open WebUI 示例：

```yaml
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    environment:
      OPENAI_API_BASE_URL: http://litellm:4000/v1
      WEBUI_AUTH: "True"
    volumes:
      - /data/openwebui:/app/backend/data
```

### 6.5 内网域名与反向代理（可选）

若希望用 `ai.company.internal` 访问，在内网 DNS 加一条 A 记录指向服务器，然后用 Nginx 反代：

```nginx
server {
    listen 80;
    server_name ai.company.internal;

    location / {
        proxy_pass http://127.0.0.1:3000;   # Open WebUI
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;            # 长推理需要，否则会断连
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;   # LiteLLM API
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }
}
```

**`proxy_read_timeout` 必须调大**，默认 60 秒会在长回答时断开。

### 6.6 并发与性能配置要点

| 层 | 参数 | 建议 |
|---|---|---|
| vLLM | `--max-num-seqs` | 从 32 起步，压测后逐步上调至显存吃满但无 OOM |
| vLLM | `--gpu-memory-utilization` | 0.85-0.90；同机跑多个模型时按卡数分配 |
| vLLM | `--max-model-len` | 按业务实际需要设，不要盲目开 128K |
| LiteLLM | `rpm_limit` / `tpm_limit` | 每把 key 单独设，防止单用户打满 |
| LiteLLM | `max_parallel_requests` | 控制在 vLLM `max-num-seqs` 的合理份额内 |
| Nginx | `proxy_read_timeout` | 600s 以上 |
| Redis | `maxmemory-policy` | `noeviction` |

### 6.7 阶段五验证

```bash
# 1. 网关健康
curl http://<IP>:4000/health/liveliness

# 2. 用虚拟 key 调模型（注意 base_url 是 4000）
curl -X POST http://<IP>:4000/v1/chat/completions \
  -H "Authorization: Bearer <员工的虚拟key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-32b","messages":[{"role":"user","content":"你好"}]}'

# 3. 确认成本头存在（本地模型成本为 0，但头应出现）
curl -s -D - -o /dev/null -X POST http://<IP>:4000/v1/chat/completions \
  -H "Authorization: Bearer <虚拟key>" -H "Content-Type: application/json" \
  -d '{"model":"qwen3-32b","messages":[{"role":"user","content":"你好"}]}' | grep -i x-litellm

# 4. 超发测试：用错 key 应被拒
curl -X POST http://<IP>:4000/v1/chat/completions -H "Authorization: Bearer sk-wrong" \
  -H "Content-Type: application/json" -d '{"model":"qwen3-32b","messages":[]}'
# 期望：401 或 403

# 5. 查看用量
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" "http://<IP>:4000/spend/logs?limit=5"
```

成功标准：第 2 步返回正常结果，第 4 步被拒绝，第 5 步能看到刚才的请求记录。

---

## 7. 验证方法、日志与排障总表

### 7.1 各阶段验收清单

| 阶段 | 验收命令 | 通过标准 |
|---|---|---|
| 一 | `ssh ops@IP`、`ufw status`、`chronyc tracking` | 密钥可登录、密码登录被拒、时间已同步 |
| 二 | `nvidia-smi`、`docker run --rm --gpus all nvidia/cuda:12.9.0-base-ubuntu24.04 nvidia-smi` | 宿主机与容器内均能看到全部 GPU |
| 三 | `du -sh /data/models/*`、检查文件列表 | 模型文件完整，大小符合预期 |
| 四 | `curl localhost:8000/health`、`curl /v1/models`、实际推理 | 健康检查 200，能列出模型，能返回结果 |
| 五 | `curl :4000/health/liveliness`、虚拟 key 调用、错误 key 被拒 | 网关可用，鉴权生效，用量有记录 |

### 7.2 日志位置

| 组件 | 日志位置 | 常用命令 |
|---|---|---|
| 系统 | journald | `journalctl -xe`、`journalctl -u docker` |
| 内核/驱动 | dmesg | `dmesg -T | grep -i nvidia`（看 XID 错误） |
| Docker 容器 | 容器 stdout | `docker logs -f vllm`、`docker logs --tail 200 litellm` |
| vLLM | 容器内 stdout | 关注模型加载进度、KV cache 大小、OOM 关键字 |
| LiteLLM | 容器 stdout | 启动时加 `--detailed_debug` 可看到完整请求链路 |
| Postgres | 容器内 | `docker exec litellm_db psql -U llmproxy -d litellm -c "select count(*) from \"LiteLLM_SpendLogs\";"` |
| GPU 实时状态 | - | `nvidia-smi dmon`、`nvidia-smi -l 1` |

### 7.3 排障思路

按顺序排查，能解决大部分问题：

1. **看 GPU 是否还在**：`nvidia-smi`。掉卡或 XID 错误（如 XID 79/13）通常指向硬件、供电或驱动问题
2. **看容器是否活着**：`docker ps -a`。反复重启多半是 OOM 或参数错误
3. **看容器日志尾部**：`docker logs --tail 100 <容器>`。vLLM 的报错通常很明确
4. **看资源**：`nvidia-smi`、`free -h`、`df -h`。显存、内存、磁盘任一耗尽都会导致异常
5. **看网络**：容器内 `curl` 依赖服务。`docker exec -it litellm curl http://vllm:8000/health`
6. **看数据库**：Postgres 不可用时 LiteLLM 会拒绝请求（除非开了 `allow_requests_on_db_unavailable`）

### 7.4 高频问题速查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 请求返回 401 | key 无效或过期 | 检查 key 是否被删、`expires` 是否到期 |
| 请求返回 429 | 触发限流或预算 | 调高 `rpm_limit`/`tpm_limit`，或检查 `max_budget` 是否耗尽 |
| 返回 "Max budget limit reached" | 预算用完 | 调预算或等待 `budget_duration` 周期重置 |
| 长回答中途断开 | Nginx 或客户端超时 | 调大 `proxy_read_timeout` 与客户端 timeout |
| 用量报表为空 | 花费异步落库有延迟 | 等待约 60 秒；检查 Redis 与 Postgres 连通 |
| GPU 利用率很低但延迟高 | 并发不足或 prefill 瓶颈 | 调大 `max-num-seqs`；开 chunked prefill |
| 显存打满后新请求失败 | KV cache 耗尽 | 降低 `max-model-len` 或 `max-num-seqs` |

---

## 8. 版本兼容性

### 8.1 推荐组合（2026-09 核对）

| 组件 | 推荐版本 | 兼容性要求 |
|---|---|---|
| OS | Ubuntu Server 24.04 LTS | 内核头文件需与驱动 DKMS 匹配 |
| 驱动 | R580 分支（nvidia-open） | Turing 及以上；CUDA 13.x 最低要求 |
| CUDA Toolkit | 12.9 | 与 vLLM 默认 wheel 一致 |
| Docker | 24.x 及以上 | - |
| nvidia-container-toolkit | 最新稳定版 | 需与 Docker 版本匹配 |
| vLLM | 0.29.0（固定 tag） | 需 CUDA 12.9 或 13.0 wheel |
| LiteLLM | main-stable 或固定版本 tag | 需 Postgres 与 Redis |
| Postgres | 16 | - |
| Redis | 7 | - |

### 8.2 核对方法

安装前在有网机器上确认以下信息，把结果记录到部署记录里：

```bash
# vLLM 最新稳定版
curl -s https://api.github.com/repos/vllm-project/vllm/releases/latest | grep tag_name

# 驱动与 CUDA 对应关系，查 NVIDIA 官方文档：
# docs.nvidia.com/datacenter/tesla/drivers/supported-drivers-and-cuda-toolkit-versions.html

# 当前内核
uname -r
```

### 8.3 兼容性红线

1. 驱动版本不能低于 CUDA 要求的分支
2. vLLM 镜像的 CUDA 版本不能高于宿主机驱动支持的版本
3. 老于 Turing 架构的 GPU 不能用 CUDA 13
4. 不同型号 GPU 不能组张量并行
5. 生产环境所有镜像必须固定 tag，禁止 `latest`

---

## 9. 端口规划

| 端口 | 服务 | 开放范围 | 说明 |
|---|---|---|---|
| 22 | SSH | 仅跳板机/运维网段 | 密钥登录，禁用密码 |
| 4000 | LiteLLM API 与 UI | 内网业务网段 | 对外提供 OpenAI 兼容接口 |
| 8000 | vLLM | 仅宿主机与网关容器 | **不要对内网全开放**，应只允许网关访问 |
| 3000 | Open WebUI | 内网用户网段 | 可选 |
| 5432 | Postgres | 仅宿主机 | 不要暴露到内网 |
| 6379 | Redis | 仅宿主机 | 不要暴露到内网 |
| 9090 | Prometheus | 监控网段 | 可选 |
| 80/443 | Nginx | 内网用户网段 | 可选 |

关键原则：**vLLM、Postgres、Redis 只对内暴露**，用户只接触 LiteLLM 和 WebUI。否则任何人都能绕过计量直接打满 GPU。

```bash
sudo ufw allow from <网关容器网段> to any port 8000 proto tcp
sudo ufw deny 5432
sudo ufw deny 6379
```

---

## 10. 数据持久化与备份

### 10.1 必须持久化的数据

| 数据 | 位置 | 重要性 | 重建成本 |
|---|---|---|---|
| 模型权重 | `/data/models` | 中 | 可重新下载（内网环境可能很麻烦），建议保留校验和清单 |
| Postgres 数据 | `/data/postgres` | **高** | 不可重建，key 与用量全在这里 |
| Redis AOF | `/data/redis` | 中 | 丢失会导致计数失真 |
| LiteLLM 配置 | `/data/deploy/litellm_config.yaml` | **高** | 丢失则服务无法启动 |
| 环境变量文件 | `/data/deploy/.env` | **高** | 含 master key 与数据库口令 |
| Open WebUI 数据 | `/data/openwebui` | 中 | 用户会话与配置 |

### 10.2 备份方案

```bash
# 每日备份 Postgres（放进 crontab）
cat > /data/deploy/backup.sh <<'EOF'
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/data/backup
mkdir -p $BACKUP_DIR
docker exec -t litellm_db pg_dump -U llmproxy -d litellm | gzip > $BACKUP_DIR/litellm_$TS.sql.gz
cp /data/deploy/litellm_config.yaml $BACKUP_DIR/config_$TS.yaml
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "config_*.yaml" -mtime +30 -delete
EOF
chmod +x /data/deploy/backup.sh

# 每天凌晨 3 点
(crontab -l 2>/dev/null; echo "0 3 * * * /data/deploy/backup.sh >> /var/log/litellm_backup.log 2>&1") | crontab -
```

要点：

- **备份要异地保存**。只放在同一台服务器的另一个目录，等于没备份。至少同步到另一台机器或 NAS
- 定期验证恢复流程，备份文件打不开的情况很常见
- `.env` 含密钥，不要进 git，不要放备份目录以外的位置
- 模型权重体积大，一般不做常规备份，但应保存一份 `sha256sum` 清单以便校验

### 10.3 日志留存

| 日志 | 建议留存 |
|---|---|
| Docker 容器日志 | 已在 daemon.json 配 `max-size: 100m, max-file: 5`，按需调整 |
| LiteLLM 用量日志（Postgres） | 按合规要求，默认 90 天；可配定期清理任务 |
| 系统日志 | 默认 journald 策略即可 |

---

## 11. 升级与变更

### 11.1 升级原则

1. **先备份，再升级**，尤其是数据库迁移
2. **固定版本 tag**，升级是"把 tag 从 A 改成 B"的显式动作
3. **灰度**：新版本先在备用端口起一个新容器，验证通过后再切流量
4. **窗口期**：提前通知用户，避免长推理被打断

### 11.2 各组件升级要点

| 组件 | 风险 | 要点 |
|---|---|---|
| vLLM | 中 | 换 tag 重启即可。注意新版本可能改参数名，先在测试配置里验证 |
| LiteLLM | **高** | 启动时会自动执行数据库迁移，且迁移是同步的，期间服务不可用。升级前必须备份 Postgres |
| 模型 | 低 | 新模型放到新目录，用新容器起在 8001，验证后改网关配置指向新地址 |
| NVIDIA 驱动 | **高** | 需停掉所有 GPU 容器，重装后重启。内核升级会触发 DKMS 重编译，务必预留窗口 |
| CUDA | 中 | 与驱动联动，一般随 vLLM 镜像更新，宿主机不必单独升 |
| 内核/系统 | 中 | 已用 `apt-mark hold` 锁住内核，人工窗口升级，升级后确认驱动模块重新编译成功 |

### 11.3 回滚

```bash
# 记录当前所有镜像 tag，升级前先保存
docker inspect --format='{{.Config.Image}}' vllm litellm > /data/deploy/current_images.txt

# 回滚：改回旧 tag 后重启
docker compose up -d

# 数据库回滚：用备份恢复
gunzip -c /data/backup/litellm_<时间戳>.sql.gz | docker exec -i litellm_db psql -U llmproxy -d litellm
```

---

## 12. 部署记录模板

建议每完成一个阶段就填写，便于后续交接与回溯。

```
部署日期：
服务器型号 / 资产编号：
GPU 型号与数量：
系统版本（lsb_release -a）：
内核版本（uname -r）：
驱动版本（nvidia-smi 顶部）：
CUDA 版本（nvcc --version）：
Docker 版本：
nvidia-container-toolkit 版本：
vLLM 镜像 tag：
LiteLLM 镜像 tag：
模型名称与量化方式：
vLLM 关键参数（TP / max-model-len / max-num-seqs / gpu-memory-utilization）：
实测吞吐（tokens/s）与并发数：
内网访问地址：
备注与遗留问题：
```

---

## 13. 附录：常用命令速查

```bash
# GPU
nvidia-smi                      # 状态总览
nvidia-smi dmon                 # 持续监控
nvidia-smi topo -m              # 卡间互联拓扑
nvidia-smi -q -d TEMPERATURE,POWER   # 温度与功耗
dmesg -T | grep -i nvidia       # 驱动层错误（XID）

# 容器
docker ps -a
docker logs -f --tail 200 vllm
docker stats                    # 实时资源占用
docker compose -f /data/deploy/docker-compose.yml up -d
docker compose -f /data/deploy/docker-compose.yml down

# 服务验证
curl http://localhost:8000/health
curl -H "Authorization: Bearer $VLLM_API_KEY" http://localhost:8000/v1/models
curl http://localhost:4000/health/liveliness
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/key/list

# 用量
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" "http://localhost:4000/spend/logs?limit=10"
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" "http://localhost:4000/global/spend/report"

# 数据库
docker exec -it litellm_db psql -U llmproxy -d litellm
docker exec -t litellm_db pg_dump -U llmproxy -d litellm | gzip > backup.sql.gz

# 磁盘
df -h
du -sh /data/models/*
du -sh /var/lib/docker
```

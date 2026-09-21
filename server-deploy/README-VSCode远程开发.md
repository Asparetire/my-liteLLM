# VS Code 远程开发 + 服务器部署

> 面向 `192.168.100.123`（hifen37）。所有结论来自对该机的实测。
> 与 `README-部署方案.md` 是同一套部署，区别只在于**代码放在哪、怎么改**。

---

## 0. 结论先行

把**代码真身放在服务器上**，VS Code 用 Remote-SSH 直接开它，容器用 bind mount 读同一份源码：

| 改动类型 | 操作步骤 | 是否需要重启容器 |
|---|---|---|
| Python（`litellm/`、`litellm_cn/`） | 保存 → `docker compose restart litellm-cn` | 需要（约 10 秒） |
| 前端（`ui/litellm-dashboard`） | `npm run build` → 覆盖 `out/` | **不需要**，刷新浏览器即可 |
| 配置（yaml / .env） | 保存 → restart | 需要 |
| 文案（`litellm_cn/locale/*.json`） | 保存 → restart | 需要 |

好处：**不再有"Windows 改完 → 上传"这一步**，改完立刻能验。

---

## 0. 先讲清楚：Remote-SSH 能做什么、不能做什么

**能做**：连上服务器后，VS Code 的界面在你本机，但文件读写、终端、调试、Git 全在服务器上跑，体验和打开本地文件夹几乎一样。这才是"远程开发"。

**不能做**：它**不会**自动把 Windows 上 `D:\project\litellm-src` 这份代码搬过去。你连上服务器打开某个目录，看到的就是服务器磁盘上的东西 —— 空目录就是空的。

所以流程是：

```
一次性搬运（本节）  →  VS Code Remote-SSH 打开服务器目录  →  之后全部在 VS Code 里改，不再同步
```

> 搬运只要做一次。搬完之后，"同步"这个概念就消失了 —— 你在 VS Code 里改的就是服务器上的那份，也就是容器挂载的那份。

### 0.1 搬运前必须知道：别传 node_modules

`D:\project\litellm-src` 的工作区一共 **69736 个文件、790 MB**，其中 `ui/litellm-dashboard/node_modules` 独占 **58669 个文件、596 MB**。

而且里面装的是 **Windows 版原生二进制**：`next-swc.win32-x64-msvc.node`（101 MB）、`sharp-win32-x64`、`esbuild win32`。这些传到 Linux 上不但没用，`npm run build` 还会被它们干扰。

好消息：`.gitignore` 第 67 行 `**/node_modules` 已经把它们忽略了，git 只跟踪 **10742 个文件**。所以用 **git 方式搬运天然安全**；如果手工 scp/rsync，务必排除 `node_modules`，到服务器重新 `npm ci` 即可。

### 0.2 三种搬运方式怎么选

| 方式 | 传什么 | 体积 | 保留 git 历史 | 推荐度 |
|---|---|---|---|---|
| **git 推送**（3.1 采用） | 受版本控制的 10742 个文件 | 约 44 MB | ✅ | ⭐ 推荐 |
| `scp` / `rsync` 手工传 | 除 node_modules 外的整目录 | 约 190 MB | ❌ | 临时用 |
| VS Code 内置 clone | 需要有远端仓库地址 | — | ✅ | 有 GitHub 私有仓库时 |

---

## 1. 目录设计

服务器上的 `~/litellm-src` **同时是 git 仓库根、VS Code 工作区、compose 工作目录**：

```
/home/hifen37/litellm-src/          ← git clone 出来的完整仓库
  .git/
  litellm/                          ← bind mount 进容器（可读写，嵌套挂 .so 必须用）
  litellm_cn/                       ← bind mount 进容器（ro）
  ui/litellm-dashboard/             ← 前端源码
  docker-compose.cn.yml             ← 部署编排
  litellm_config.cn.yaml            ← 网关配置
  rust_bridge/_native.abi3.so       ← 从原版镜像取出的 Rust 扩展
  ui_cn/                            ← 可选：汉化 UI 构建产物
  .venv/                            ← 可选：仅供 VS Code 智能提示/单测
  .env                              ← 不入库
  data/                             ← pg/redis 数据，不入库
  .vscode/settings.json
```

对比之前那套"上传模式"：

| | 远程开发模式（本文件） | 上传模式（原方案） |
|---|---|---|
| 代码真身 | 服务器 `~/litellm-src`（git） | Windows `D:\project\litellm-src` |
| 同步方式 | 无，直接改 | `sync_fork.py` 上传 67 MB |
| 迭代速度 | 秒级 | 每次多一步上传 |
| git 历史 | 完整保留 | 需要单独搬运 |
| 适合 | **长期开发（推荐）** | 临时验证 |

> **重要**：选了远程开发模式后，Windows 上那份副本就不要再改了，否则双写必然冲突。建议当成只读备份，或直接用服务器的。

---

## 2. 把代码搬到服务器（保留 git 历史）

> **嫌手工麻烦就直接跑一键脚本**（Windows PowerShell，在本机仓库目录外执行）：
>
> ```powershell
> cd D:\project\litellm-src
> .\server-deploy\setup-remote.ps1 -SetupKey -GitName "你的名字" -GitEmail "你的邮箱"
> ```
>
> 它会自动完成下面 2.1 - 2.5 的全部步骤：建裸仓库 → 推送 → 服务器克隆 → 复制编排与 VS Code 设置 → 跑 `server_init.sh`。
> 不会启动容器、不会碰 4000 上的原版。想顺便起服务就加 `-Start`。
> 手工执行的话看下面。

### 2.1 服务器上建裸仓库

```bash
mkdir -p ~/git && git init --bare ~/git/litellm-src.git
```

### 2.2 Windows 侧推送

在本机仓库目录（`D:\project\litellm-src`，分支 `develop`）里执行：

```powershell
git remote add server hifen37@192.168.100.123:git/litellm-src.git
git push -u server develop
# 提示输密码时输入服务器密码
```

仓库比较大（含 `litellm/proxy/_experimental/out`、`enterprise/*.whl` 等），首次推送在局域网内一般 1-3 分钟。

### 2.3 服务器上克隆

```bash
cd ~
git clone ~/git/litellm-src.git litellm-src
cd ~/litellm-src
git checkout develop
git branch --show-current          # 应为 develop
```

### 2.4 设置 git 身份（服务器上是空的，不设会 commit 失败）

```bash
git config --global user.name  "你的名字"
git config --global user.email "你的邮箱"
git config --global init.defaultBranch develop
```

### 2.5 搬完之后还需要同步吗

**不需要。** 从这一步起，服务器上的 `~/litellm-src` 就是唯一真身：VS Code 改它，容器挂它。

只有一种情况要同步：**你想让 Windows 上那份也保持最新**。那就是普通的 git 操作：

```bash
# 服务器端提交后推送到裸仓库
git push server develop

# Windows 侧拉取
cd D:\project\litellm-src
git pull server develop
```

> 反过来在 Windows 改、服务器拉，也可以，但**别两边同时改同一批文件**，会冲突。
> 建议：**开发在服务器（VS Code），Windows 那份只读**。真要在 Windows 改，先 pull 再改再 push。

另外可以把 GitHub 私有仓库也加进来当异地备份：

```bash
git remote add origin git@github.com:<你>/litellm-src.git
```

---

## 3. VS Code 连接

### 3.1 装扩展

本机 VS Code 安装：**Remote - SSH**（`ms-vscode-remote.remote-ssh`）。

### 3.2 配 SSH 免密（强烈建议，否则每次重连都要输密码）

**当前状态（2026-09-18 已配好，可直接跳到 3.3）**：服务器 `~/.ssh/authorized_keys` 里已有 3 条公钥，其中
`ssh-rsa ... administrator@WIN-VFLHEGUOM6I` 对应本机的 `C:\Users\Administrator\.ssh\id_rsa`，实测 `ssh litellm-server` 免密直连成功。

> ⚠️ 一个踩过的坑：本机 OpenSSH for Windows 9.5 用 **ed25519** 时会在签名阶段失败
> （服务器接受了 key，客户端报 `sign_and_send_pubkey` 错误）。改用 **RSA 4096** 后正常。
> 所以配置里统一用 `id_rsa`，不要用 `id_ed25519`。

如果换机器 / 重装系统，重配一次：

```powershell
# 1) 生成 RSA 4096（一路回车）
ssh-keygen -t rsa -b 4096 -C "administrator@WIN"

# 2) 追加公钥到服务器（会提示输入服务器密码）
Get-Content $env:USERPROFILE\.ssh\id_rsa.pub | ssh hifen37@192.168.100.123 "cat >> ~/.ssh/authorized_keys"

# 3) 验证：这次应该不再要密码
ssh litellm-server "echo 免密OK"
```

### 3.3 配置 `C:\Users\<你>\.ssh\config`

已写好（Windows OpenSSH 读的就是这个文件）：

```
Host litellm-server
  HostName 192.168.100.123
  User hifen37
  IdentityFile C:/Users/Administrator/.ssh/id_rsa
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

要点：
- `IdentityFile` 写**正斜杠**的完整路径，`~` 在 Windows 版 OpenSSH 里不一定展开
- 加 `IdentitiesOnly yes`，避免 ssh-agent 里别的 key 抢先失败
- `ServerAliveInterval` 防长时间不动被掐断（VS Code 远程最常遇到的断连就是这个）

### 3.4 连接

`F1` → **Remote-SSH: Connect to Host** → 选 `litellm-server` → 打开文件夹 `/home/hifen37/litellm-src`。

首次连接会在服务器 `~/.vscode-server` 装服务端，约 1-2 分钟。

命令行一步直达（跳过选 host 和选目录）：

```powershell
code --folder-uri "vscode-remote://ssh-remote+litellm-server/home/hifen37/litellm-src"
```

### 3.5 端口转发（浏览器直接访问网关）

连上后，VS Code 底部「端口」面板 → 转发端口 `4001`（二开版）和 `4000`（原版）。
之后本机浏览器打开 `http://localhost:4001/ui/` 就是服务器上的控制台，不用记 IP。

---

## 4. 工作区配置（必做，否则大仓库会卡）

这个仓库有 3000+ 个 Python 文件、还有 `enterprise/`、`cookbook/`、`helm/`、`litellm-rust/`，默认的文件监听会让 VS Code 和服务器都变卡。

把 `server-deploy/vscode/settings.json` 复制到 `~/litellm-src/.vscode/settings.json`（扩展推荐在 `extensions.json`）。

关键项说明：

| 配置 | 作用 |
|---|---|
| `files.watcherExclude` | 不监听 `out/`、`node_modules/`、`enterprise/`、`data/`、`.venv/`，避免 inode 耗尽与 CPU 空转 |
| `search.exclude` | 全局搜索跳过编译产物与企业混淆包，搜索从几十秒降到秒级 |
| `python.defaultInterpreterPath` | 指向 5.1 建的 venv |
| `[python] editor.rulers: [120]` | 上游规范：行宽 120 |
| `git.autofetch: false` | 大仓库自动 fetch 会周期性卡顿 |

---

## 5. 搭建开发环境

> 只改文案/配置/前端的话，5.1 和 5.2 都可以先跳过。需要智能提示、跳转定义、跑单测时才做。

### 5.1 Python（uv + venv）

服务器现状：系统 Python **3.14.4**，`python3 -m pip` **不存在**，没有 uv，sudo 需要密码。
另外 **`github.com` 在这台机器上不通**，而 uv 的"托管 Python"是从 GitHub Releases 下载的，所以 `uv venv --python 3.13` 让它自动下载会失败——要用 apt 装的 Python。

```bash
# 1) 装 pip / uv（会提示输入 sudo 密码）
sudo apt update
sudo apt install -y python3-pip python3.13-venv
python3 -m pip install --user -i https://pypi.tuna.tsinghua.edu.cn/simple uv
# 若 Ubuntu 26.04 源里直接有 uv，也可以：sudo apt install -y uv

# 2) 建 venv（显式指定解释器，别让 uv 去 GitHub 下载）
cd ~/litellm-src
export UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
uv venv --python /usr/bin/python3.13   # 若没有 3.13，改用 /usr/bin/python3.14

# 3) 装依赖（首次约 5-15 分钟）
uv sync --frozen --extra proxy --group proxy-dev
uv run python scripts/prisma_generate_if_needed.py
```

验证：`uv run python -c "import litellm; print('ok')"`

> 注意：这个 `.venv` **只服务 VS Code 与单测**。真正跑起来的进程在容器里，用的是镜像自带的 `/app/.venv`，两者互不影响。

### 5.2 Node（前端构建）

服务器没有 node/nvm。`nodejs.org` 实测可达，直接装二进制版：

```bash
cd /tmp
VER=v24.21.0
curl -fsSLO "https://nodejs.org/dist/$VER/node-$VER-linux-x64.tar.xz"
curl -fsSLO "https://nodejs.org/dist/$VER/SHASUMS256.txt"
grep "node-$VER-linux-x64.tar.xz" SHASUMS256.txt | sha256sum -c -     # 必须 OK 才能继续
mkdir -p ~/.local
tar -xJf "node-$VER-linux-x64.tar.xz" -C ~/.local
mv ~/.local/node-$VER-linux-x64 ~/.local/node
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
node -v      # v24.21.0
```

前端要求 `>=24.14.1`（`ui/litellm-dashboard/package.json` 的 engines），24.21.0 满足。

---

## 6. 日常操作

### 6.1 启动二开版

> 2026-09-18 已完成首次部署并跑通：`litellm-cn` 在 4001 healthy，
> `bash server-deploy/verify.sh 4001` **10/10 通过**（中文错误、真实调用、token 计费均已验证）。
> 原版 4000 全程未受影响。排障细节见 `README-部署方案.md` 第 4.5 节。

> **注意**：compose 里的 `./litellm`、`./data` 等相对路径是按 **compose 文件所在目录**解析的，
> 所以必须把编排文件放在仓库根，不能直接 `-f server-deploy/docker-compose.cn.yml`。

```bash
cd ~/litellm-src
# 一次性：把编排与配置复制到仓库根（后续直接改根目录这两份）
cp server-deploy/docker-compose.cn.yml .
cp server-deploy/litellm_config.cn.yaml .

bash server-deploy/server_init.sh          # 取 .so、生成 .env、写 .git/info/exclude
vi .env                                     # 改掉 PG_PASSWORD
docker compose -f docker-compose.cn.yml -p litellm-cn up -d
docker compose -p litellm-cn logs -f litellm-cn
bash server-deploy/verify.sh 4001
```

### 6.2 改 Python 之后

```bash
docker compose -p litellm-cn restart litellm-cn
docker compose -p litellm-cn logs -f --tail 100 litellm-cn
```

### 6.3 改前端之后

```bash
cd ~/litellm-src/ui/litellm-dashboard
npm run build
# 覆盖进被挂载的目录，容器里的 /ui 立刻生效，不用重启
rsync -a --delete out/ ../../litellm/proxy/_experimental/out/
```

想热更新就跑开发服务器（VS Code 转发 3000 端口）：

```bash
echo 'NEXT_PUBLIC_BASE_URL=http://localhost:4001' > .env.local
npm run dev
```

### 6.4 查看运行状态

```bash
docker compose -p litellm-cn ps
curl -s localhost:4001/health/readiness
curl -s localhost:4001/v1/models -H "Authorization: Bearer $KEY"
docker compose -p litellm-cn logs -f --tail 200 litellm-cn
```

原版仍在 `4000`，随时 `docker ps` 确认两个都在跑。

### 6.5 提交与推送

```bash
git checkout -b feat/xxx
git add -A && git commit -m "feat: ..."      # conventional commits
git push -u server feat/xxx
```

---

## 7. 坑位清单

| 现象 | 原因 | 处理 |
|---|---|---|
| VS Code 连上后很卡 / 文件改动不生效 | 大仓库文件监听打满 | 配置第 4 节的 `files.watcherExclude` |
| 在容器里改 `litellm_cn/` 被拒 | 该目录挂载是 `:ro` | 正常。在 VS Code 里改宿主机文件 |
| 在容器里改 `litellm/` 居然成功了 | fork 源码挂的是可读写（嵌套挂 Rust `.so` 的需要） | 尽量别在容器里改，还是在 VS Code 里改宿主机那份 |
| `uv venv --python 3.13` 卡住或失败 | uv 去 GitHub 下托管 Python，而 github.com 不通 | 用 apt 装的 `/usr/bin/python3.13` |
| `python3 -m pip` 报 No module named pip | 系统没装 pip | `sudo apt install -y python3-pip` |
| `git commit` 报身份未配置 | 服务器 git 未设 user | 第 2.4 节 |
| `npm run build` 报 engines 不满足 | node 版本不够 | 装 24.x，见 5.2 |
| 改了 Python 但没生效 | 没重启容器 | `docker compose -p litellm-cn restart litellm-cn` |
| 前端改了 `/ui` 没变 | 没 build 覆盖 | 6.3 的 rsync 一步 |
| 中文错误没生效 | `litellm_cn` 没挂进去 | `docker exec litellm-cn python -c "import litellm_cn"` |
| Windows 本地那份和服务器不一致 | 双写 | 确定服务器为唯一真身，本地只读 |

---

## 8. 建议的落地顺序

1. 配 SSH 免密 → VS Code 连上（30 分钟内）
2. 搬运代码（第 2 节）→ 设 git 身份
3. 复制 `.vscode/settings.json`
4. `server_init.sh` → 改 `.env` → `docker compose up -d` → `verify.sh 4001`
5. 确认二开版正常后，再决定要不要装 uv/Node（5.1、5.2）
6. 之后就是改代码 → restart → 验证的循环

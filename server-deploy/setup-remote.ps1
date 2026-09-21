<#
.SYNOPSIS
把 litellm-src 同步到服务器并搭好 VS Code 远程开发环境（一次性）。

.DESCRIPTION
依次完成：
  1) （可选）把本机 SSH 公钥装到服务器，实现免密
  2) 服务器上建裸仓库 ~/git/litellm-src.git
  3) 本机推送分支（保留提交历史，约 44 MB）
  4) 服务器克隆到 ~/litellm-src，并切到与本机当前相同的分支
  5) 把编排、配置、VS Code 设置复制到仓库根
  6) 跑 server_init.sh（取 Rust 扩展、生成 .env、写 .git/info/exclude）

不会启动容器，也不会碰现有 4000 端口上的原版服务。

.EXAMPLE
.\setup-remote.ps1 -GitName hifen -GitEmail hifen@example.com
.\setup-remote.ps1 -SetupKey -GitName hifen -GitEmail hifen@example.com
#>

param(
    [string]$Server = "192.168.100.123",
    [string]$User = "hifen37",
    [string]$Branch = "",
    [string]$RemoteDir = "litellm-src",
    [string]$GitName = "",
    [string]$GitEmail = "",
    [switch]$SetupKey,
    [switch]$Start,
    [switch]$SkipPush
)

# 注意：必须是 Continue。设为 Stop 时，git/ssh 写到 stderr 的普通提示
# （例如 error: No such remote）会被 PowerShell 当成终止错误，脚本会莫名中断。
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Target = $User + "@" + $Server

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "    XX  $msg" -ForegroundColor Red; exit 1 }

function Remote($cmd) {
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 $Target $cmd
    if ($LASTEXITCODE -ne 0) { Die "远程命令失败（exit=$LASTEXITCODE）: $cmd" }
}

function GitQ {
    param([string[]]$GitArgs)
    & git @GitArgs 2>&1 | Out-Null
    return $LASTEXITCODE
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LiteLLM 二开版 -> 服务器远程开发环境" -ForegroundColor Cyan
Write-Host (" 源  : " + $RepoRoot)
Write-Host (" 目标: " + $Target + " :~/" + $RemoteDir)
Write-Host "==============================================" -ForegroundColor Cyan

# ---------- 0. 确定要同步的分支 ----------
Push-Location $RepoRoot
$cur = (& git branch --show-current).Trim()
Pop-Location
if ([string]::IsNullOrEmpty($cur)) { Die "拿不到当前分支，仓库可能处于 detached HEAD" }
if ([string]::IsNullOrEmpty($Branch)) { $Branch = $cur }
Write-Host (" 分支: 本机当前 = " + $cur + " ，本次同步 = " + $Branch)

# ---------- 1. SSH 免密 ----------
if ($SetupKey) {
    Step "配置 SSH 免密"
    $sshDir = Join-Path $env:USERPROFILE ".ssh"
    $pub = Join-Path $sshDir "id_rsa.pub"
    if (-not (Test-Path $pub)) {
        if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir -Force | Out-Null }
        Write-Host "    生成 RSA 密钥（一路回车）..."
        & ssh-keygen -t rsa -b 4096 -f (Join-Path $sshDir "id_rsa") -N '""' -q 2>&1 | Out-Null
    }
    Get-Content $pub | ssh -o StrictHostKeyChecking=no $Target "mkdir -p ~/.ssh; chmod 700 ~/.ssh; touch ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; cat >> ~/.ssh/authorized_keys"
    Ok "公钥已追加"
}

# ---------- 2. 服务器裸仓库 ----------
Step "服务器上建裸仓库 ~/git/$RemoteDir.git"
Remote "mkdir -p ~/git ; git init --bare -q ~/git/$RemoteDir.git 2>/dev/null ; echo done"
Ok "裸仓库就绪"

# ---------- 3. 本机推送 ----------
Step "推送分支（约 44 MB，局域网内 1-3 分钟）"
Push-Location $RepoRoot
GitQ @("remote", "remove", "server") | Out-Null
$rc = GitQ @("remote", "add", "server", ($Target + ":git/" + $RemoteDir + ".git"))
if ($rc -ne 0) { Pop-Location; Die "添加 remote 失败" }

if ($SkipPush) {
    Warn "已跳过推送（-SkipPush）"
} else {
    & git push server $Branch 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "推送失败" }
    & git push server --tags 2>&1 | Out-Null
    Ok "推送完成"
}
Pop-Location

# ---------- 4. 服务器克隆 ----------
Step "服务器克隆到 ~/$RemoteDir"
Remote "cd ~ ; if [ -d ~/$RemoteDir/.git ]; then echo 已存在跳过克隆; else git clone -q ~/git/$RemoteDir.git $RemoteDir; fi"
Remote "cd ~/$RemoteDir ; git fetch --all -q ; git checkout -q $Branch ; git pull --ff-only -q origin $Branch 2>/dev/null ; git branch --show-current"
Ok "工作副本就绪"

# ---------- 5. git 身份 ----------
if ($GitName -ne "" -and $GitEmail -ne "") {
    Step "设置服务器 git 身份"
    Remote "git config --global user.name '$GitName' ; git config --global user.email '$GitEmail' ; git config --global init.defaultBranch develop"
    Ok "已设置为 $GitName / $GitEmail"
} else {
    Warn "未传 -GitName/-GitEmail，服务器上 git 身份未设置，commit 会失败"
}

# ---------- 6. 复制部署文件到仓库根 ----------
Step "复制编排 / 配置 / VS Code 设置到仓库根"
Remote "cd ~/$RemoteDir ; cp server-deploy/docker-compose.cn.yml . ; cp server-deploy/litellm_config.cn.yaml . ; mkdir -p .vscode ; cp server-deploy/vscode/settings.json .vscode/ ; cp server-deploy/vscode/extensions.json .vscode/"
Ok "compose 相对卷路径按文件所在目录解析，所以必须放仓库根"

# ---------- 7. 初始化 ----------
Step "运行 server_init.sh"
Remote "cd ~/$RemoteDir ; bash server-deploy/server_init.sh"

# ---------- 8. 可选启动 ----------
if ($Start) {
    Step "启动二开版（端口 4001）"
    Remote "cd ~/$RemoteDir ; docker compose -f docker-compose.cn.yml -p litellm-cn up -d"
    Start-Sleep -Seconds 25
    Remote "cd ~/$RemoteDir ; bash server-deploy/verify.sh 4001"
}

# ---------- 收尾 ----------
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " 完成" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "接下来："
Write-Host ""
Write-Host "  1) 改掉新库密码（.env 里现在是占位值）"
Write-Host "       ssh $Target"
Write-Host "       vi ~/$RemoteDir/.env          # 改 PG_PASSWORD"
Write-Host ""
Write-Host "  2) VS Code 装 Remote-SSH，连 $Server ，打开 /home/$User/$RemoteDir"
Write-Host "       转发端口 4001，浏览器开 http://localhost:4001/ui/"
Write-Host ""
Write-Host "  3) 启动二开版"
Write-Host "       cd ~/$RemoteDir"
Write-Host "       docker compose -f docker-compose.cn.yml -p litellm-cn up -d"
Write-Host "       docker compose -p litellm-cn logs -f litellm-cn"
Write-Host "       bash server-deploy/verify.sh 4001"
Write-Host ""
Write-Host "  4) 日常：改代码后 docker compose -p litellm-cn restart litellm-cn"
Write-Host "     前端：npm run build 后 rsync 覆盖 out/，连重启都不用"
Write-Host ""
Write-Host "  5) 想让 Windows 这份也保持最新： git pull server $Branch"
Write-Host ""
Write-Host "原版仍在 4000，全程不受影响。"
Write-Host ""

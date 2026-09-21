# 推送本地提交到开发服务器（192.168.100.123）并让服务器工作区更新
#
# 用法（在仓库根目录 D:\project\litellm-src 下，PowerShell 执行）：
#   .\server-deploy\push-to-server.ps1                          # 推当前分支并在服务器端检出更新
#   .\server-deploy\push-to-server.ps1 -Branch develop          # 推 develop
#   .\server-deploy\push-to-server.ps1 -Force                   # 服务器端未提交改动直接丢弃（危险）
#
# 原理：服务器上有裸仓库 /home/hifen37/git/litellm-src.git 作为中转
#（服务器访问不了 github，这个裸仓库就是服务器侧的 origin）。
# 本地通过 SSH 推到裸仓库，再 SSH 让服务器工作区 git pull。
# SSH 免密走 ~/.ssh/id_rsa（ssh config 里别名 litellm-server）。

param(
    [string]$Branch = "",
    [string]$ServerAlias = "litellm-server",
    [string]$BareRepo = "/home/hifen37/git/litellm-src.git",
    [string]$ServerDir = "/home/hifen37/litellm-src",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $Branch) {
    $Branch = git rev-parse --abbrev-ref HEAD
    if (-not $Branch -or $Branch -eq "HEAD") { throw "当前处于 detached HEAD，请用 -Branch 指定分支" }
}
Write-Host "==> 推送分支: $Branch"

# ---- 1. 注册/更新 server 远程并推送 ----
$remoteUrl = "ssh://${ServerAlias}${BareRepo}"
if (git remote | Select-String -Quiet "^server$") {
    git remote set-url server $remoteUrl
} else {
    git remote add server $remoteUrl
}
git push server $Branch
if ($LASTEXITCODE -ne 0) { throw "git push 失败" }

# ---- 2. 服务器工作区更新到最新提交 ----
Write-Host "==> 服务器端更新工作区"
$forceFlag = if ($Force) { "yes" } else { "no" }
$remoteScript = @"
set -e
cd $ServerDir
if [ -n "`$(git status --porcelain)" ] && [ "$forceFlag" != "yes" ]; then
    git stash push -q -m "push-to-server 自动备份" || true
    echo '（服务器端原有未提交改动已 stash 备份，git stash list 可查）'
fi
git pull --ff-only origin $Branch
echo '==> 完成，服务器端当前状态：'
git log --oneline -3
git branch --show-current
"@
ssh $ServerAlias $remoteScript
if ($LASTEXITCODE -ne 0) { throw "服务器端更新失败" }

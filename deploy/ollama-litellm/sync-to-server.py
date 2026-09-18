#!/usr/bin/env python3
"""把本目录的部署产物同步到网关服务器。

本目录是部署产物的唯一副本（改完再推服务器），服务器上另有 .env / data / setup.sh
是它独有的，脚本不会碰。

用法：
    GW_SSH_PASSWORD=xxx python sync-to-server.py              # 同步
    GW_SSH_PASSWORD=xxx python sync-to-server.py --dry-run    # 只看差异
    GW_SSH_PASSWORD=xxx python sync-to-server.py --restart    # 同步后重建网关容器

环境变量：
    GW_SSH_HOST      默认 192.168.100.123
    GW_SSH_USER      默认 hifen37
    GW_SSH_PASSWORD  必填（不写进文件，避免随 git 泄漏）
    GW_REMOTE_DIR    默认 /home/hifen37/ollama-litellm

依赖：pip install paramiko（本机可用 C:/Users/Administrator/.workbuddy/binaries/python/envs/default）
"""

import argparse
import hashlib
import os
import posixpath
import sys
import time
from datetime import datetime

try:
    import paramiko
except ImportError:
    sys.exit("缺少 paramiko：pip install paramiko")

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP_DIRS = {"data", "__pycache__", ".git"}

# 这两个文件改了必须重建容器才生效
NEEDS_RESTART = {"docker-compose.yml", "litellm_config.yaml", "patches/sitecustomize.py"}


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()[:8]


def local_files() -> dict:
    out = {}
    for cur, dirs, files in os.walk(HERE):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.startswith("_") or ".bak" in name or name.endswith(".pyc"):
                continue
            path = os.path.join(cur, name)
            out[os.path.relpath(path, HERE).replace("\\", "/")] = path
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只对比，不写服务器")
    ap.add_argument("--restart", action="store_true", help="同步后 docker compose up -d litellm")
    args = ap.parse_args()

    host = os.environ.get("GW_SSH_HOST", "192.168.100.123")
    user = os.environ.get("GW_SSH_USER", "hifen37")
    password = os.environ.get("GW_SSH_PASSWORD", "")
    remote = os.environ.get("GW_REMOTE_DIR", "/home/hifen37/ollama-litellm")
    if not password:
        sys.exit("请设置 GW_SSH_PASSWORD（建议 GATEWAY_PASSWORD=... 前缀执行，别写进文件）")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=20, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()

    def run(cmd, timeout=600):
        _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        return stdout.read().decode("utf-8", "replace").strip(), stderr.read().decode("utf-8", "replace").strip()

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    files = local_files()
    changed, unchanged, added = [], [], []

    print(f"{'文件':<36}{'服务器':<11}{'本地':<11}状态")
    print("-" * 76)
    for rel, path in sorted(files.items()):
        data = open(path, "rb").read()
        try:
            with sftp.open(posixpath.join(remote, rel), "rb") as f:
                existing = f.read()
        except IOError:
            existing = None
        lh = md5(data)
        if existing is None:
            print(f"{rel:<36}{'-':<11}{lh:<11}服务器缺失")
            added.append((rel, data))
        elif md5(existing) == lh:
            print(f"{rel:<36}{md5(existing):<11}{lh:<11}一致")
            unchanged.append(rel)
        else:
            print(f"{rel:<36}{md5(existing):<11}{lh:<11}内容不同")
            changed.append((rel, data))

    if not changed and not added:
        print("\n服务器已是最新，无需同步。")
        sftp.close()
        client.close()
        return 0

    if args.dry_run:
        print(f"\n[dry-run] 待上传 {len(added)} 个新增、{len(changed)} 个更新。")
        sftp.close()
        client.close()
        return 0

    print()
    for rel, data in added + changed:
        target = posixpath.join(remote, rel)
        run(f"mkdir -p {posixpath.dirname(target)}")
        if rel in {r for r, _ in changed}:
            run(f"cp {target} {target}.bak-{stamp}")
        with sftp.open(target, "wb") as f:
            f.write(data)
        sftp.chmod(target, 0o644)
        print(f"  已上传 {rel}{'（已备份 .bak-' + stamp + '）' if rel in {r for r, _ in changed} else ''}")

    touched = NEEDS_RESTART & {rel for rel, _ in added + changed}
    sftp.close()
    client.close()

    print()
    if touched:
        print("改动涉及需要重启才生效的文件：" + "、".join(sorted(touched)))
    if args.restart:
        client2 = paramiko.SSHClient()
        client2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client2.connect(host, username=user, password=password, timeout=20, allow_agent=False, look_for_keys=False)
        _, stdout, _ = client2.exec_command(f"cd {remote} && docker compose up -d litellm 2>&1 | tail -6", timeout=600)
        print(stdout.read().decode("utf-8", "replace").strip())
        print("等待网关就绪…")
        time.sleep(15)
        _, stdout, _ = client2.exec_command(
            "for i in $(seq 1 90); do "
            "curl -sf -m 3 http://127.0.0.1:4000/health/liveliness >/dev/null 2>&1 && { echo READY; break; }; "
            "sleep 2; done",
            timeout=300,
        )
        print("网关:", stdout.read().decode("utf-8", "replace").strip() or "未就绪")
        client2.close()
    elif touched:
        print(f"生效命令：cd {remote} && docker compose up -d litellm")

    return 0


if __name__ == "__main__":
    sys.exit(main())

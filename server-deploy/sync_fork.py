#!/usr/bin/env python3
"""把本机 fork 源码增量上传到服务器。

只传运行必需的两个目录：litellm/（约 67 MB / 3534 个文件）与 litellm_cn/。
按 mtime + size 比对，第二次起只传改动过的文件。

用法（Windows PowerShell）：
    $env:LITELLM_SERVER_PWD = "<服务器密码>"
    python server-deploy/sync_fork.py --host 192.168.100.123 --user hifen37

依赖：pip install paramiko
密码优先取 --password，其次环境变量 LITELLM_SERVER_PWD，都没有则交互式输入。
不要把密码写进本文件。
"""

from __future__ import annotations

import argparse
import os
import stat
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    sys.exit("缺少 paramiko：pip install paramiko")

REPO_ROOT = Path(__file__).resolve().parent.parent
SYNC_DIRS = ["litellm", "litellm_cn"]
# 全仓模式（阶段二构建镜像时用）：在 EXCLUDE_DIR_NAMES 基础上再排除这些
# 注意不能排除 ui/ —— Dockerfile 的 ui-builder 阶段要用它构建前端
FULL_REPO_EXTRA_EXCLUDE = {".venv", ".workbuddy"}
# 部署文件：单独映射到目标目录根，因为 compose 里的相对路径是相对 compose 文件所在目录的
SYNC_FILES = {
    "server-deploy/docker-compose.cn.yml": "docker-compose.cn.yml",
    "server-deploy/litellm_config.cn.yaml": "litellm_config.cn.yaml",
}
EXCLUDE_DIR_NAMES = {"__pycache__", ".pytest_cache", ".ruff_cache", ".git", "node_modules"}
EXCLUDE_SUFFIXES = {".pyc", ".pyo", ".tmp"}


def iter_local_files(base: Path, full_repo: bool = False) -> list[tuple[Path, str]]:
    """返回 [(本地绝对路径, 相对仓库根的路径)]，已过滤缓存与临时文件。"""
    dirs = ["."] if full_repo else SYNC_DIRS
    extra = FULL_REPO_EXTRA_EXCLUDE if full_repo else set()
    result: list[tuple[Path, str]] = []
    for rel in dirs:
        root = base / rel
        if not root.is_dir():
            print(f"[warn] 跳过不存在的目录：{root}")
            continue
        for path in root.rglob("*"):
            parts = set(path.parts)
            if parts & EXCLUDE_DIR_NAMES or parts & extra:
                continue
            if not path.is_file() or path.suffix in EXCLUDE_SUFFIXES:
                continue
            result.append((path, path.relative_to(base).as_posix()))
    for src_rel, dst_rel in SYNC_FILES.items():
        src = base / src_rel
        if src.is_file():
            result.append((src, dst_rel))
        else:
            print(f"[warn] 跳过不存在的部署文件：{src}")
    return result


def ensure_remote_dir(sftp: paramiko.SFTPClient, path: str) -> None:
    """mkdir -p 的 SFTP 版本。绝对路径必须保留前导 /，否则会建到 home 下的相对路径。"""
    parts = [p for p in path.split("/") if p]
    if not parts:
        return
    current = "" if path.startswith("/") else "."
    for part in parts:
        current = f"{current}/{part}"
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current)


def main() -> int:
    parser = argparse.ArgumentParser(description="同步 fork 源码到服务器")
    parser.add_argument("--host", default="192.168.100.123")
    parser.add_argument("--user", default="hifen37")
    parser.add_argument("--password", default=None)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--remote-dir", default="~/litellm-cn",
                        help="服务器目标目录，默认 ~/litellm-cn")
    parser.add_argument("--full", action="store_true",
                        help="忽略 mtime 比对，全量重传")
    parser.add_argument("--full-repo", action="store_true",
                        help="整仓上传（阶段二构建镜像时需要，含 ui/ 源码）")
    parser.add_argument("--dry-run", action="store_true",
                        help="只列出将要上传的文件，不实际传输")
    args = parser.parse_args()

    password = args.password or os.getenv("LITELLM_SERVER_PWD")
    if not password and not args.dry_run:
        import getpass
        password = getpass.getpass(f"{args.user}@{args.host} 密码：")

    files = iter_local_files(REPO_ROOT, full_repo=args.full_repo)
    if args.full_repo:
        # 整仓模式上传到独立目录，避免和阶段一的运行目录混在一起
        args.remote_dir = args.remote_dir.rstrip("/") + "-src"
    total_bytes = sum(p.stat().st_size for p, _ in files)
    print(f"待比对 {len(files)} 个文件，共 {total_bytes / 1024 / 1024:.1f} MB")

    if args.dry_run:
        for _, rel in files[:20]:
            print("  " + rel)
        if len(files) > 20:
            print(f"  ... 另有 {len(files) - 20} 个")
        return 0

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"连接 {args.user}@{args.host}:{args.port} ...")
    client.connect(args.host, port=args.port, username=args.user, password=password,
                   timeout=20, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()

    remote_root = args.remote_dir.replace("~", "/home/" + args.user)
    ensure_remote_dir(sftp, remote_root)
    print(f"目标目录 {remote_root}")

    uploaded = skipped = failed = 0
    sent_bytes = 0
    for idx, (local_path, rel) in enumerate(files, start=1):
        remote_path = f"{remote_root}/{rel}"
        st = local_path.stat()

        if not args.full:
            try:
                rstat = sftp.stat(remote_path)
                if rstat.st_size == st.st_size and int(rstat.st_mtime) >= int(st.st_mtime):
                    skipped += 1
                    continue
            except IOError:
                pass

        ensure_remote_dir(sftp, remote_path.rsplit("/", 1)[0])
        try:
            sftp.put(str(local_path), remote_path)
            sftp.utime(remote_path, (st.st_atime, st.st_mtime))
            sftp.chmod(remote_path, stat.S_IMODE(st.st_mode) | 0o444)
            uploaded += 1
            sent_bytes += st.st_size
        except OSError as exc:
            failed += 1
            print(f"[error] {rel}: {exc}")
            continue

        if idx % 500 == 0:
            print(f"  ... {idx}/{len(files)}，已传 {sent_bytes / 1024 / 1024:.1f} MB")

    sftp.close()
    client.close()

    print(f"\n完成：上传 {uploaded} 个（{sent_bytes / 1024 / 1024:.1f} MB），"
          f"跳过 {skipped} 个未变，失败 {failed} 个")
    print("下一步：在服务器上执行 docker compose -p litellm-cn restart litellm-cn")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

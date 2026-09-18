"""通过 SSH 直接修复服务器配置（一次性运维脚本）"""
import sys, time, paramiko

HOST, USER, PWD = "192.168.100.123", "hifen37", "123456"
SUDO_OK = False


def run(cli, cmd, timeout=180, show=True):
    global SUDO_OK
    if cmd.strip().startswith("sudo ") and SUDO_OK:
        cmd = cmd.replace("sudo ", "sudo -n ", 1)
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if show:
        print(f"$ {cmd}")
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("  [stderr]", err.strip()[:500])
        print(f"  -> exit {code}")
    return out, err, code


def main():
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, username=USER, password=PWD, timeout=20)
    print(f"=== 已连接 {USER}@{HOST} ===\n")

    # 建立 sudo 凭证缓存
    stdin, stdout, stderr = cli.exec_command("sudo -S -v", timeout=30)
    stdin.write(PWD + "\n")
    stdin.flush()
    rc = stdout.channel.recv_exit_status()
    err = stderr.read().decode(errors="replace")
    global SUDO_OK
    SUDO_OK = (rc == 0)
    print(f"sudo 凭证: {'OK' if SUDO_OK else 'FAILED ' + err[:200]}\n")
    if not SUDO_OK:
        return

    print("=== 1. 现状 ===")
    run(cli, "ollama list")
    run(cli, "systemctl is-active ollama")
    run(cli, "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader")

    print("\n=== 2. 上传 litellm_config.yaml ===")
    sftp = cli.open_sftp()
    sftp.put("litellm_config.yaml", "/home/hifen37/ollama-litellm/litellm_config.yaml")
    sftp.close()
    run(cli, "cd ~/ollama-litellm && md5sum litellm_config.yaml && grep -c 'num_ctx: 32768' litellm_config.yaml")

    print("\n=== 3. 写入 Ollama systemd override ===")
    content = (
        "[Service]\n"
        'Environment="OLLAMA_HOST=0.0.0.0:11434"\n'
        'Environment="OLLAMA_CONTEXT_LENGTH=32768"\n'
        'Environment="OLLAMA_NUM_PARALLEL=1"\n'
        'Environment="OLLAMA_KEEP_ALIVE=24h"\n'
        'Environment="OLLAMA_MAX_LOADED_MODELS=1"\n'
        'Environment="OLLAMA_FLASH_ATTENTION=1"\n'
    )
    escaped = content.replace("'", "'\"'\"'")
    run(cli, "sudo mkdir -p /etc/systemd/system/ollama.service.d")
    run(cli, f"printf '%s' '{escaped}' | sudo tee /etc/systemd/system/ollama.service.d/override.conf")
    run(cli, "sudo systemctl daemon-reload")
    run(cli, "sudo systemctl restart ollama")
    time.sleep(8)
    run(cli, "systemctl is-active ollama")
    run(cli, "sudo systemctl cat ollama | grep -A10 'override.conf' | head -12")
    run(cli, "curl -s -m 5 http://127.0.0.1:11434/api/tags -o /dev/null -w 'tags:%{http_code}\\n'")

    print("\n=== 4. 重启 LiteLLM 网关 ===")
    run(cli, "cd ~/ollama-litellm && docker compose restart litellm", timeout=300)
    print("  等待 75 秒让网关启动...")
    time.sleep(75)
    run(cli, "cd ~/ollama-litellm && docker compose ps --format 'table {{.Name}}\\t{{.Status}}'")
    run(cli, "curl -s -m 10 http://127.0.0.1:4000/health/liveliness; echo")

    print("\n=== 5. 最终状态 ===")
    run(cli, "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader")
    run(cli, "cd ~/ollama-litellm && MASTER=$(grep LITELLM_MASTER_KEY .env | cut -d= -f2) && curl -s -m 10 -H \"Authorization: Bearer $MASTER\" http://127.0.0.1:4000/v1/models")
    cli.close()
    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()

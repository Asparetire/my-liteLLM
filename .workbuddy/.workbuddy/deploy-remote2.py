"""SSH 修复脚本 v2：sudo 用 stdin 喂密码 + 关键文件走 sftp，规避非 tty 会话限制"""
import time, paramiko

HOST, USER, PWD = "192.168.100.123", "hifen37", "123456"


def run(cli, cmd, timeout=240, show=True):
    """sudo 一律用 echo <pwd> | sudo -S 形式，保证每条命令自带凭证"""
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if show:
        print(f"$ {cmd[:150]}")
        if out.strip():
            print(out.rstrip()[:2000])
        if err.strip():
            e = "\n".join(l for l in err.splitlines() if "password for" not in l)
            if e.strip():
                print("  [stderr]", e.strip()[:400])
        print(f"  -> {code}")
    return out, err, code


def main():
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, username=USER, password=PWD, timeout=20)
    print(f"=== 已连接 {USER}@{HOST} ===\n")

    sftp = cli.open_sftp()

    print("=== 1. 上传 LiteLLM 配置 ===")
    sftp.put("litellm_config.yaml", "/home/hifen37/ollama-litellm/litellm_config.yaml")
    run(cli, "cd ~/ollama-litellm && grep -E '^  - model_name|num_ctx' litellm_config.yaml")

    print("\n=== 2. 写入 Ollama systemd override（经 sftp + sudo cp）===")
    with open("ollama-override.conf", "w", newline="\n") as f:
        f.write(
            "[Service]\n"
            'Environment="OLLAMA_HOST=0.0.0.0:11434"\n'
            'Environment="OLLAMA_CONTEXT_LENGTH=32768"\n'
            'Environment="OLLAMA_NUM_PARALLEL=1"\n'
            'Environment="OLLAMA_KEEP_ALIVE=24h"\n'
            'Environment="OLLAMA_MAX_LOADED_MODELS=1"\n'
            'Environment="OLLAMA_FLASH_ATTENTION=1"\n'
        )
    run(cli, f"echo '{PWD}' | sudo -S mkdir -p /etc/systemd/system/ollama.service.d")
    sftp.put("ollama-override.conf", "/tmp/ollama-override.conf")
    run(cli, f"echo '{PWD}' | sudo -S cp /tmp/ollama-override.conf /etc/systemd/system/ollama.service.d/override.conf")
    run(cli, f"echo '{PWD}' | sudo -S chmod 644 /etc/systemd/system/ollama.service.d/override.conf")
    run(cli, "cat /etc/systemd/system/ollama.service.d/override.conf")

    print("\n=== 3. 重启 Ollama 并确认新参数生效 ===")
    run(cli, f"echo '{PWD}' | sudo -S systemctl daemon-reload")
    run(cli, f"echo '{PWD}' | sudo -S systemctl restart ollama")
    time.sleep(10)
    run(cli, "systemctl is-active ollama")
    run(cli, "curl -s -m 5 http://127.0.0.1:11434/api/tags -o /dev/null -w 'tags:%{http_code}\\n'")
    run(cli, "ps aux | grep -o 'OLLAMA_CONTEXT_LENGTH=[0-9]*\\|OLLAMA_NUM_PARALLEL=[0-9]*' | sort -u")

    print("\n=== 4. 重启 LiteLLM 网关 ===")
    run(cli, "cd ~/ollama-litellm && docker compose restart litellm", timeout=300)
    print("  等待 70 秒...")
    time.sleep(70)
    run(cli, "curl -s -m 10 http://127.0.0.1:4000/health/liveliness; echo")
    run(cli, "cd ~/ollama-litellm && MASTER=$(grep LITELLM_MASTER_KEY .env | cut -d= -f2) && "
             "curl -s -m 10 -H \"Authorization: Bearer $MASTER\" http://127.0.0.1:4000/v1/models")

    print("\n=== 5. 显存 ===")
    run(cli, "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader")
    sftp.close()
    cli.close()
    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()

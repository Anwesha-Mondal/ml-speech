"""One-command runner for Speech Arena frontend and backend.

Usage:
    python dev.py
    npm run dev
    .\\start.ps1
    start.bat
"""

import os
import sys
import shutil
import signal
import subprocess
import threading
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"


def get_python_exe() -> str:
    """Find virtualenv python, falling back to system python."""
    if os.name == "nt":
        venv_py = ROOT / ".venv" / "Scripts" / "python.exe"
    else:
        venv_py = ROOT / ".venv" / "bin" / "python"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable


def get_npm_cmd() -> str:
    """Find npm executable."""
    npm_path = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm_path:
        raise RuntimeError("npm is not installed or not in PATH.")
    return npm_path


def stream_output(process: subprocess.Popen, prefix: str):
    """Stream process stdout line-by-line with prefix."""
    try:
        for line in iter(process.stdout.readline, b""):
            decoded = line.decode("utf-8", errors="replace").rstrip()
            if decoded:
                print(f"[{prefix}] {decoded}", flush=True)
    except Exception:
        pass


def free_port(port: int) -> None:
    """If a previous dev server was left hanging on this port, terminate it."""
    if os.name == "nt":
        try:
            out = subprocess.check_output(
                ["powershell", "-Command", f"(Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue).OwningProcess"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            for pid_str in out.split():
                pid = int(pid_str)
                if pid > 4:
                    subprocess.call(["taskkill", "/F", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def main():
    backend_only = "--backend-only" in sys.argv
    frontend_only = "--frontend-only" in sys.argv

    if not frontend_only:
        free_port(8000)
    if not backend_only:
        free_port(5173)

    py_exe = get_python_exe()
    npm_cmd = get_npm_cmd()

    print("\n" + "=" * 60)
    print("  [*] Starting Speech Arena (Full Stack Dev Environment)")
    print("=" * 60)
    print(f"  * Python Interpreter : {py_exe}")
    print(f"  * Frontend Directory : {FRONTEND_DIR}")
    print("  * Backend API URL    : http://127.0.0.1:8000")
    print("  * Frontend App URL   : http://localhost:5173")
    print("  * Press Ctrl+C anytime to stop both services")
    print("=" * 60 + "\n", flush=True)

    processes: list[subprocess.Popen] = []

    # 1. Start Backend
    if not frontend_only:
        backend_cmd = [
            py_exe,
            "-m",
            "uvicorn",
            "backend.api.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            "--reload",
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(backend_proc)
        t_be = threading.Thread(
            target=stream_output,
            args=(backend_proc, "backend"),
            daemon=True,
        )
        t_be.start()

    # 2. Start Frontend
    if not backend_only:
        frontend_cmd = [npm_cmd, "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(frontend_proc)
        t_fe = threading.Thread(
            target=stream_output,
            args=(frontend_proc, "frontend"),
            daemon=True,
        )
        t_fe.start()

    def cleanup(signum=None, frame=None):
        print("\n[*] Shutting down services...", flush=True)
        for proc in processes:
            try:
                if os.name == "nt":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    proc.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, cleanup)

    try:
        # Wait for any process to exit
        while True:
            for proc in processes:
                ret = proc.poll()
                if ret is not None:
                    print(f"[*] Process exited with code {ret}")
                    cleanup()
            import time
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()

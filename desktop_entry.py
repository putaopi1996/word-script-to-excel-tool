from __future__ import annotations

import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from app import create_app


PORT = 5000
LOCK_FILE_NAME = ".word-script-excel-tool.lock"


def resource_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def get_lock_path() -> Path:
    """Lock file next to the exe/script."""
    if getattr(sys, "frozen", False):
        base = Path(sys.executable).resolve().parent
    else:
        base = Path(__file__).resolve().parent
    return base / LOCK_FILE_NAME


def kill_old_instance() -> None:
    """Kill existing instance if running."""
    import signal

    lock_path = get_lock_path()
    if not lock_path.exists():
        return

    try:
        old_pid = int(lock_path.read_text().strip())
    except (ValueError, OSError):
        lock_path.unlink(missing_ok=True)
        return

    # Check if the process is still alive and kill it
    try:
        os.kill(old_pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        pass  # Process already dead

    # Also try to wait briefly for port to free up
    import time
    for _ in range(10):
        if not is_port_in_use(PORT):
            break
        time.sleep(0.3)

    lock_path.unlink(missing_ok=True)


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def write_lock_file() -> None:
    lock_path = get_lock_path()
    lock_path.write_text(str(os.getpid()), encoding="utf-8")


def cleanup_lock_file() -> None:
    lock_path = get_lock_path()
    lock_path.unlink(missing_ok=True)


def open_browser() -> None:
    webbrowser.open(f"http://127.0.0.1:{PORT}")


def main() -> int:
    # Kill any existing instance before starting
    kill_old_instance()

    # Write our PID to lock file
    write_lock_file()

    try:
        app = create_app(resource_root=resource_root())
        if not os.environ.get("WERKZEUG_RUN_MAIN"):
            threading.Timer(1.5, open_browser).start()
        app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)
    finally:
        cleanup_lock_file()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

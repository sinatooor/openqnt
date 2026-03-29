"""
ADK Web UI Manager

Spawns and manages the `adk web` process, auto-detects its port,
and returns the URL to the frontend.
"""

import asyncio
import os
import re
import socket
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/adk", tags=["adk-web"])

# ── Process state ─────────────────────────────────────────────
_proc: Optional[subprocess.Popen] = None
_adk_port: Optional[int] = None
_adk_url: Optional[str] = None

BACKEND_DIR = Path(__file__).resolve().parent.parent
# Dedicated workspace for `adk web` — contains only properly structured agent packages.
# Pointing at BACKEND_DIR directly would cause adk to scan unrelated dirs (strategy_flow, etc.)
ADK_WORKSPACE = BACKEND_DIR / "adk_workspace"


def _find_free_port(start: int = 8080, end: int = 8200) -> int:
    """Find first free TCP port in range."""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start}-{end}")


def _is_alive() -> bool:
    """Return True if the adk web process is still running."""
    return _proc is not None and _proc.poll() is None


async def _wait_for_port(port: int, timeout: float = 20.0) -> bool:
    """Poll until port is accepting connections or timeout."""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection("127.0.0.1", port), timeout=0.5
            )
            writer.close()
            await writer.wait_closed()
            return True
        except Exception:
            await asyncio.sleep(0.4)
    return False


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/status")
async def adk_status():
    """Return current state of the adk web process."""
    global _proc, _adk_port, _adk_url

    if not _is_alive():
        _proc = None
        _adk_port = None
        _adk_url = None
        return {"running": False, "url": None, "port": None}

    return {
        "running": True,
        "url": _adk_url,
        "port": _adk_port,
    }


@router.post("/start")
async def adk_start():
    """
    Start `adk web` if not already running.
    Finds a free port, spawns the process, waits for it to be ready,
    and returns the URL.
    """
    global _proc, _adk_port, _adk_url

    # Already running — just return current URL
    if _is_alive():
        return {"running": True, "url": _adk_url, "port": _adk_port, "already_running": True}

    # Pick a free port (avoid 8000 which is the main backend)
    try:
        port = _find_free_port(start=8080)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Resolve the adk command — prefer the venv/conda executable next to python
    adk_cmd = _resolve_adk_cmd()
    if not adk_cmd:
        raise HTTPException(
            status_code=500,
            detail=(
                "Could not find the `adk` command. "
                "Make sure `google-adk` is installed in your active environment: "
                "pip install google-adk"
            ),
        )

    cmd = [adk_cmd, "web", str(ADK_WORKSPACE), "--port", str(port)]

    try:
        # Run from BACKEND_DIR so all backend packages are importable without extra sys.path tricks
        env = {
            **os.environ,
            "PORT": str(port),
            "PYTHONPATH": str(BACKEND_DIR) + os.pathsep + os.environ.get("PYTHONPATH", ""),
        }
        _proc = subprocess.Popen(
            cmd,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to spawn adk web: {e}")

    _adk_port = port
    _adk_url = f"http://localhost:{port}"

    # Wait until the port is actually accepting connections
    ready = await _wait_for_port(port, timeout=25.0)

    if not ready:
        # Try to read any startup error from stdout
        stderr_snippet = ""
        if _proc.stdout:
            try:
                import fcntl
                flags = fcntl.fcntl(_proc.stdout, fcntl.F_GETFL)
                fcntl.fcntl(_proc.stdout, fcntl.F_SETFL, flags | os.O_NONBLOCK)
                stderr_snippet = _proc.stdout.read(2000) or ""
            except Exception:
                pass

        # Kill if it didn't start
        try:
            _proc.terminate()
        except Exception:
            pass
        _proc = None
        _adk_port = None
        _adk_url = None

        detail = "adk web did not start within 25 seconds."
        if stderr_snippet:
            detail += f"\n\nOutput:\n{stderr_snippet}"
        raise HTTPException(status_code=500, detail=detail)

    return {"running": True, "url": _adk_url, "port": _adk_port, "already_running": False}


@router.post("/stop")
async def adk_stop():
    """Terminate the running adk web process."""
    global _proc, _adk_port, _adk_url

    if not _is_alive():
        _proc = None
        _adk_port = None
        _adk_url = None
        return {"stopped": False, "message": "adk web was not running"}

    try:
        _proc.terminate()
        try:
            _proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _proc.kill()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop process: {e}")

    _proc = None
    _adk_port = None
    _adk_url = None
    return {"stopped": True}


# ── Helpers ───────────────────────────────────────────────────

def _resolve_adk_cmd() -> Optional[str]:
    """
    Find the `adk` executable in the active Python environment.

    When the backend is started with `conda activate fyer && uvicorn main:app`,
    sys.executable points to the fyer env's Python binary, e.g.:
        /opt/anaconda3/envs/fyer/bin/python
    So `adk` lives right next to it:
        /opt/anaconda3/envs/fyer/bin/adk

    This means the spawned `adk web` process automatically inherits the full
    conda fyer environment — no extra activation step needed.
    """
    import shutil

    # 1. Sibling to the current Python interpreter (venv / conda bin)
    python_bin = Path(sys.executable).parent
    for candidate in [python_bin / "adk", python_bin / "adk.exe"]:
        if candidate.exists():
            print(f"[ADK] Using adk from conda/venv env: {candidate}")
            return str(candidate)

    # 2. Fall back to PATH
    found = shutil.which("adk")
    if found:
        print(f"[ADK] Using adk from PATH: {found}")
    else:
        print(f"[ADK] adk not found. Python env: {sys.executable}")
    return found

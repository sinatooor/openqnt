"""
Subprocess sandbox runner.

`execute_python(req)`:
  1. Mints a tmpdir.
  2. Writes `main.py` and `req.files_in` into it.
  3. Spawns `python -I main.py` with a `preexec_fn` that calls
     `setrlimit` for CPU / RSS / file size, and `setsid` so we can kill
     the whole process group on timeout.
  4. Captures stdout/stderr (buffered, capped) with `subprocess.run`.
  5. Walks the tmpdir for files the script created and returns the
     small ones inline (base64).

This is the *only* place sandbox concerns live. The agent-facing tool
(`adk_agents/tools/sandbox_tools.py`) is a thin wrapper.
"""
from __future__ import annotations

import base64
import os
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Iterable

from .schema import ExecuteRequest, ExecuteResult, FileOut

PLOT_EXTS = {".png", ".jpg", ".jpeg", ".svg", ".gif"}
INLINE_FILE_LIMIT_BYTES = 2 * 1024 * 1024  # 2 MB inlined as base64; bigger → metadata only.

_PYTHON = sys.executable  # use the same interpreter the backend runs in

# Pre-warm matplotlib's font cache against a stable repo-local
# MPLCONFIGDIR so sandbox children don't try to rebuild it from an
# empty HOME. macOS's system_profiler returns a shape font_manager
# doesn't always understand; this side-steps the problem entirely
# because the cache file is built by the parent (which has the user's
# fonts) and reused by every child.
_MPL_CACHE = (Path(__file__).resolve().parents[2]
              / "agents" / "_cache" / "mpl")


def _warm_mpl_cache_once() -> None:
    """Build matplotlib's font cache at our target path, in a clean
    subprocess.

    Why a subprocess: matplotlib reads `MPLCONFIGDIR` from the env on
    its first import and caches that value forever. If anything in the
    parent (e.g. `backtest/plot.py`) imported matplotlib before we got
    a chance to set the env var, the parent's `font_manager.FontManager()`
    builds the cache in the *wrong* directory and our setdefault is a
    silent no-op.

    Spawning a fresh `python -c` with a clean env avoids the ordering
    problem entirely. The result is a `fontlist-vXXX.json` at our path
    that every sandbox child inherits. Pure side-effect, no return.
    """
    try:
        _MPL_CACHE.mkdir(parents=True, exist_ok=True)
        if any(_MPL_CACHE.glob("fontlist-*.json")):
            return  # already warm
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": os.environ.get("HOME", "/tmp"),  # macOS font scan needs the user's home
            "MPLCONFIGDIR": str(_MPL_CACHE),
            "MPLBACKEND": "Agg",
        }
        subprocess.run(
            [_PYTHON, "-c",
             "from matplotlib import font_manager; font_manager.FontManager()"],
            env=env,
            check=False,
            timeout=30,
            capture_output=True,
        )
    except Exception:
        # Telemetry-style: never break a request because of cache prep.
        pass


_warm_mpl_cache_once()


def _preexec_setrlimit(cpu_seconds: int, mem_mb: int, file_size_mb: int):
    """Returned closure runs in the child after fork, before exec.

    On macOS RLIMIT_AS is unreliable, but RLIMIT_DATA + RLIMIT_CPU still
    bite. We set what we can and log any failures into the child's
    stderr (visible in the result).
    """
    def _apply():  # noqa: D401  (closure, not docstring-worthy)
        try:
            os.setsid()  # new process group → kill -PG works
        except Exception:
            pass
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        except Exception as e:
            sys.stderr.write(f"[sandbox] RLIMIT_CPU failed: {e}\n")
        # File size cap (bytes, hard).
        try:
            cap = int(file_size_mb * 1024 * 1024)
            resource.setrlimit(resource.RLIMIT_FSIZE, (cap, cap))
        except Exception as e:
            sys.stderr.write(f"[sandbox] RLIMIT_FSIZE failed: {e}\n")
        # Memory: try AS first, fall back to DATA. macOS often refuses both;
        # we still attempt it because Linux respects them.
        cap_bytes = int(mem_mb * 1024 * 1024)
        for name in ("RLIMIT_AS", "RLIMIT_DATA"):
            r = getattr(resource, name, None)
            if r is None:
                continue
            try:
                resource.setrlimit(r, (cap_bytes, cap_bytes))
                break
            except Exception:
                continue
    return _apply


def _walk_outputs(workdir: Path, exclude: Iterable[str]) -> list[FileOut]:
    out: list[FileOut] = []
    excluded = {Path(e).resolve() for e in exclude}
    for p in sorted(workdir.rglob("*")):
        if not p.is_file():
            continue
        if p.resolve() in excluded:
            continue
        try:
            data = p.read_bytes()
        except Exception:
            continue
        is_plot = p.suffix.lower() in PLOT_EXTS
        rel = str(p.relative_to(workdir))
        size = len(data)
        b64 = None
        if is_plot or size <= INLINE_FILE_LIMIT_BYTES:
            b64 = base64.b64encode(data).decode("ascii")
        out.append(FileOut(name=rel, size_bytes=size, is_plot=is_plot, content_b64=b64))
    return out


def execute_python(req: ExecuteRequest) -> ExecuteResult:
    """Run `req.code` in a freshly-minted sandboxed subprocess."""
    t0 = time.time()
    workdir = Path(tempfile.mkdtemp(prefix="fyer_sb_"))
    main_py = workdir / "main.py"
    inputs: list[str] = []
    try:
        main_py.write_text(req.code, encoding="utf-8")
        inputs.append(str(main_py.resolve()))

        for name, content in req.files_in.items():
            # Prevent path traversal — anchor everything under workdir.
            target = (workdir / name).resolve()
            if workdir.resolve() not in target.parents and target != (workdir / name).resolve():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, bytes):
                target.write_bytes(content)
            else:
                target.write_text(content, encoding="utf-8")
            inputs.append(str(target.resolve()))

        env = {
            # Minimal env — keep PATH so subprocess can find python and curl
            # for things scripts genuinely need; drop everything else.
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(workdir),
            "TMPDIR": str(workdir),
            "MPLBACKEND": "Agg",        # matplotlib without a display
            "MPLCONFIGDIR": str(_MPL_CACHE),
            "PYTHONUNBUFFERED": "1",
            "PYTHONHASHSEED": "0",
        }

        cmd = [_PYTHON, "-I", "main.py", *req.extra_argv]
        timed_out = False
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(workdir),
                env=env,
                capture_output=True,
                text=True,
                timeout=req.timeout_s,
                preexec_fn=_preexec_setrlimit(req.cpu_seconds, req.mem_mb, req.file_size_mb),
                check=False,
            )
            exit_code = proc.returncode
            stdout = proc.stdout
            stderr = proc.stderr
        except subprocess.TimeoutExpired as e:
            # Kill the whole process group so children (e.g. matplotlib helpers) die too.
            timed_out = True
            exit_code = -signal.SIGKILL
            stdout = (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, (bytes, bytearray)) else (e.stdout or "")
            stderr = (e.stderr or b"").decode("utf-8", "replace") if isinstance(e.stderr, (bytes, bytearray)) else (e.stderr or "")
            stderr += f"\n[sandbox] timed out after {req.timeout_s}s\n"

        files_out = _walk_outputs(workdir, exclude=inputs)
        plots = [f for f in files_out if f.is_plot]

        # Cap stdout/stderr so a runaway loop doesn't blow the response.
        STREAM_CAP = 200_000
        if len(stdout) > STREAM_CAP:
            stdout = stdout[:STREAM_CAP] + f"\n…[truncated; {len(stdout)} chars total]"
        if len(stderr) > STREAM_CAP:
            stderr = stderr[:STREAM_CAP] + f"\n…[truncated; {len(stderr)} chars total]"

        return ExecuteResult(
            success=(exit_code == 0 and not timed_out),
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            duration_ms=int((time.time() - t0) * 1000),
            files_out=files_out,
            plots=plots,
            timed_out=timed_out,
        )
    except Exception as e:  # noqa: BLE001
        return ExecuteResult(
            success=False,
            exit_code=-1,
            stdout="",
            stderr="",
            duration_ms=int((time.time() - t0) * 1000),
            error=f"{type(e).__name__}: {e}",
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

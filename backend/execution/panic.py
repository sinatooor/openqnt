"""
Global kill switch — file-backed so it survives a backend restart.

`is_active()`           — quick boolean check (used by the risk gate).
`engage(reason)`        — flip the switch on. Emits the reason + ts.
`clear()`               — manual reset (UI calls this).
`status() -> dict`      — for the UI badge.

Lock file lives at `agents/_execution/panic.lock` (NOT in cwd, so the
state is the same wherever the backend is launched from).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PANIC_DIR = Path(__file__).resolve().parents[2] / "agents" / "_execution"
PANIC_FILE = PANIC_DIR / "panic.lock"


class PanicService:
    @staticmethod
    def is_active() -> bool:
        return PANIC_FILE.exists()

    @staticmethod
    def status() -> dict[str, Any]:
        if not PANIC_FILE.exists():
            return {"active": False}
        try:
            return {"active": True, **json.loads(PANIC_FILE.read_text() or "{}")}
        except Exception:
            return {"active": True}

    @staticmethod
    def engage(reason: str = "") -> dict[str, Any]:
        PANIC_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "reason": reason or "engaged",
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        PANIC_FILE.write_text(json.dumps(payload))
        return {"active": True, **payload}

    @staticmethod
    def clear() -> dict[str, Any]:
        if PANIC_FILE.exists():
            PANIC_FILE.unlink()
        return {"active": False}

"""
On-disk store for the copilot's shared memory.

Single-tenant: everything lives under one MEMORY_ROOT. A `MEMORY_ROOT` seam is
left so a future web build can namespace per-user without touching callers —
resolve MEMORY_ROOT from a request-scoped user id there.

All writes go through `_resolve()` (path-traversal guarded, confined to
MEMORY_ROOT) and a single process lock, so a cron fire and a chat message can't
corrupt the same file. Files are size-capped; the journal rolls by entry count.
"""

from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Roots ─────────────────────────────────────────────────────────────
# Reuse the same data-dir convention as backend/agent_runtime/storage.py so
# desktop builds (OPENQWNT_DATA_DIR) and repo-local dev agree.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = Path(os.environ.get("OPENQWNT_DATA_DIR", str(_REPO_ROOT)))

# Explicit override wins (tests set this); else <DATA_DIR>/memory.
MEMORY_ROOT = Path(os.environ.get("MEMORY_ROOT", str(_DATA_DIR / "memory")))

_DEFAULTS_DIR = Path(__file__).resolve().parent / "defaults"
_ASSETS_SUBDIR = "assets"

# ── File registry ─────────────────────────────────────────────────────
# name -> metadata. `agent_writable` gates the curator; `default` names the
# seed template under defaults/. soul.md is human-only by design.
SINGLETONS: dict[str, dict[str, Any]] = {
    "soul.md":      {"agent_writable": False, "default": "soul.md",      "title": "Soul (personality)"},
    "user.md":      {"agent_writable": True,  "default": "user.md",      "title": "About you"},
    "portfolio.md": {"agent_writable": True,  "default": "portfolio.md", "title": "Portfolio"},
    "watchlist.md": {"agent_writable": True,  "default": "watchlist.md", "title": "Watchlist"},
    "market.md":    {"agent_writable": True,  "default": "market.md",    "title": "Market / macro"},
    "lessons.md":   {"agent_writable": True,  "default": "lessons.md",   "title": "Lessons (playbook)"},
    "journal.md":   {"agent_writable": True,  "default": "journal.md",   "title": "Journal"},
}

# Files the curator is allowed to fully rewrite (journal is append-only, soul is human-only).
CURATOR_WRITABLE_SINGLETONS = {
    n for n, m in SINGLETONS.items() if m["agent_writable"] and n != "journal.md"
}

# ── Caps ──────────────────────────────────────────────────────────────
SOFT_CAP_CHARS = 8_000     # curator is asked to keep files under this
HARD_CAP_CHARS = 16_000    # store truncates anything larger (safety)
MAX_JOURNAL_ENTRIES = 60   # journal rolls: keep the most recent N lines

_LOCK = threading.RLock()

_TICKER_MAX = 12


# ── Path guarding ─────────────────────────────────────────────────────

def is_valid_ticker(ticker: str) -> bool:
    t = (ticker or "").strip().upper()
    if not t or len(t) > _TICKER_MAX:
        return False
    return all(c.isalnum() or c in ".-" for c in t) and t[0].isalpha()


def normalize_name(name: str) -> str:
    """Canonicalize a caller-supplied memory file name.

    Accepts 'portfolio.md', 'AAPL' / 'aapl.md' / 'assets/AAPL.md' (asset),
    with or without the .md suffix. Returns a repo-relative name like
    'portfolio.md' or 'assets/AAPL.md'. Raises ValueError on anything unsafe.
    """
    raw = (name or "").strip().replace("\\", "/")
    if not raw or ".." in raw or raw.startswith("/"):
        raise ValueError(f"unsafe memory name: {name!r}")

    # Asset file?
    if raw.startswith(f"{_ASSETS_SUBDIR}/"):
        ticker = raw[len(_ASSETS_SUBDIR) + 1:]
        ticker = ticker[:-3] if ticker.endswith(".md") else ticker
        if not is_valid_ticker(ticker):
            raise ValueError(f"invalid ticker: {ticker!r}")
        return f"{_ASSETS_SUBDIR}/{ticker.upper()}.md"

    base = raw if raw.endswith(".md") else f"{raw}.md"
    if base in SINGLETONS:
        return base

    # Bare ticker like "AAPL" -> assets/AAPL.md
    stem = base[:-3]
    if is_valid_ticker(stem):
        return f"{_ASSETS_SUBDIR}/{stem.upper()}.md"

    raise ValueError(f"unknown memory file: {name!r}")


def _resolve(name: str) -> Path:
    canonical = normalize_name(name)
    p = (MEMORY_ROOT / canonical).resolve()
    # Belt-and-suspenders: never escape MEMORY_ROOT.
    root = MEMORY_ROOT.resolve()
    if root not in p.parents and p != root:
        raise ValueError(f"path escapes memory root: {name!r}")
    return p


# ── Seeding defaults ──────────────────────────────────────────────────

def _default_text(name: str) -> str:
    meta = SINGLETONS.get(name)
    if meta and meta.get("default"):
        dp = _DEFAULTS_DIR / meta["default"]
        if dp.exists():
            return dp.read_text(encoding="utf-8")
    return ""


def _asset_default_text(ticker: str) -> str:
    dp = _DEFAULTS_DIR / "asset.template.md"
    tpl = dp.read_text(encoding="utf-8") if dp.exists() else "# {ticker}\n"
    return tpl.replace("{ticker}", ticker.upper()).replace(
        "{date}", datetime.now(timezone.utc).date().isoformat()
    )


def ensure_seeded() -> None:
    """Create MEMORY_ROOT and seed any missing singleton files. Idempotent."""
    with _LOCK:
        MEMORY_ROOT.mkdir(parents=True, exist_ok=True)
        (MEMORY_ROOT / _ASSETS_SUBDIR).mkdir(parents=True, exist_ok=True)
        for name in SINGLETONS:
            p = MEMORY_ROOT / name
            if not p.exists():
                p.write_text(_default_text(name), encoding="utf-8")


# ── Read / write ──────────────────────────────────────────────────────

def read(name: str) -> str:
    """Read a memory file, seeding a singleton from its default if missing."""
    p = _resolve(name)
    if not p.exists():
        canonical = normalize_name(name)
        if canonical in SINGLETONS:
            with _LOCK:
                if not p.exists():
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_text(_default_text(canonical), encoding="utf-8")
        elif canonical.startswith(f"{_ASSETS_SUBDIR}/"):
            return ""  # asset files are created on demand by write()
        else:
            return ""
    return p.read_text(encoding="utf-8")


def _cap(content: str) -> str:
    if len(content) <= HARD_CAP_CHARS:
        return content
    return content[:HARD_CAP_CHARS] + "\n\n<!-- truncated: exceeded memory size cap -->\n"


def write(name: str, content: str) -> str:
    """Overwrite a memory file. Returns the canonical name written."""
    canonical = normalize_name(name)
    p = _resolve(name)
    with _LOCK:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(_cap(content), encoding="utf-8")
    return canonical


def write_checked(name: str, content: str, *, actor: str = "agent") -> str:
    """Like write() but enforces write policy for agent actors.

    - soul.md is never writable by the agent.
    - journal.md must go through append_journal().
    """
    canonical = normalize_name(name)
    if actor == "agent":
        if canonical == "soul.md":
            raise PermissionError("soul.md is human-only; the agent cannot edit it")
        if canonical == "journal.md":
            raise PermissionError("use append_journal() for the journal")
        is_asset = canonical.startswith(f"{_ASSETS_SUBDIR}/")
        if not is_asset and canonical not in CURATOR_WRITABLE_SINGLETONS:
            raise PermissionError(f"agent may not write {canonical}")
    return write(name, content)


def reset_to_default(name: str) -> str:
    """Reset a singleton file back to its shipped default template."""
    canonical = normalize_name(name)
    if canonical not in SINGLETONS:
        raise ValueError(f"no default for {canonical}")
    return write(canonical, _default_text(canonical))


# ── Journal (append-only, rolling) ────────────────────────────────────

def append_journal(entry: str) -> None:
    """Append a single dated line to the journal, rolling old entries out."""
    entry = " ".join((entry or "").split())  # collapse whitespace to one line
    if not entry:
        return
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    line = f"- **{stamp}Z** — {entry}"
    with _LOCK:
        p = _resolve("journal.md")
        cur = read("journal.md")
        header, lines = _split_journal(cur)
        lines.append(line)
        lines = lines[-MAX_JOURNAL_ENTRIES:]
        p.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")


def _split_journal(text: str) -> tuple[str, list[str]]:
    """Return (header_block, entry_lines). Header = everything up to the first bullet."""
    lines = text.splitlines()
    entries = [ln for ln in lines if ln.lstrip().startswith("- ")]
    # Header is the leading non-bullet block (title + intro), preserved verbatim.
    head: list[str] = []
    for ln in lines:
        if ln.lstrip().startswith("- "):
            break
        head.append(ln)
    header = ("\n".join(head).rstrip() + "\n\n") if head else "# Journal\n\n"
    return header, entries


# ── Listing ───────────────────────────────────────────────────────────

def list_assets() -> list[str]:
    d = MEMORY_ROOT / _ASSETS_SUBDIR
    if not d.exists():
        return []
    # Filter by ticker validity so we never advertise a name (e.g. a stray
    # hand-dropped "foo bar.md") that read()/normalize_name() would reject.
    return sorted(f.stem.upper() for f in d.glob("*.md") if is_valid_ticker(f.stem))


def list_files() -> list[dict[str, Any]]:
    """Describe every memory file (for the UI browser and curator context)."""
    ensure_seeded()
    out: list[dict[str, Any]] = []
    for name, meta in SINGLETONS.items():
        p = MEMORY_ROOT / name
        out.append({
            "name": name,
            "title": meta["title"],
            "agent_writable": meta["agent_writable"],
            "has_default": bool(meta.get("default")),
            "size": p.stat().st_size if p.exists() else 0,
        })
    for ticker in list_assets():
        name = f"{_ASSETS_SUBDIR}/{ticker}.md"
        p = MEMORY_ROOT / name
        out.append({
            "name": name,
            "title": f"Asset · {ticker}",
            "agent_writable": True,
            "has_default": False,
            "size": p.stat().st_size if p.exists() else 0,
        })
    return out


def ensure_asset(ticker: str) -> str:
    """Ensure an asset file exists (seeded from template), return canonical name."""
    if not is_valid_ticker(ticker):
        raise ValueError(f"invalid ticker: {ticker!r}")
    canonical = f"{_ASSETS_SUBDIR}/{ticker.upper()}.md"
    p = _resolve(canonical)
    with _LOCK:
        if not p.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(_asset_default_text(ticker), encoding="utf-8")
    return canonical

"""
Scoped memory operations.

The one place that says what may be done to memory. The curator applies edits
through here (actor="agent", so soul.md is protected and the journal is
append-only); the REST router uses actor="user" for human edits. Everything is
confined to MEMORY_ROOT by store._resolve().
"""

from __future__ import annotations

from typing import Any

from . import store


def list_memory() -> list[dict[str, Any]]:
    return store.list_files()


def read_memory(name: str) -> str:
    return store.read(name)


def write_memory(name: str, content: str, *, actor: str = "agent") -> str:
    return store.write_checked(name, content, actor=actor)


def append_journal(entry: str) -> None:
    store.append_journal(entry)


def ensure_asset(ticker: str) -> str:
    return store.ensure_asset(ticker)


def reset_memory(name: str) -> str:
    return store.reset_to_default(name)


def apply_update(*, file: str, content: str, actor: str = "agent") -> str:
    """Apply one curator update. Ensures asset files exist first."""
    canonical = store.normalize_name(file)
    if canonical.startswith("assets/"):
        # create-from-template if new, then overwrite with curated content
        store.ensure_asset(canonical[len("assets/"):-3])
    return store.write_checked(canonical, content, actor=actor)

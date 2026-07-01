"""
Retrieval — assemble the scoped memory injected INTO a run/chat.

Always: soul + user + portfolio + lessons + market (all small, size-capped).
On-demand: assets/<TICKER>.md for the tickers in scope. The journal is not
injected (it's activity history, not knowledge). Output is a single markdown
block, bounded by `max_chars`.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from . import store

# Uppercase 1-5 char tokens, optional $ prefix — a cheap ticker sniffer.
_TICKER_RE = re.compile(r"\$?\b([A-Z]{1,5})\b")
# Common all-caps words that are not tickers, to cut false positives.
_STOPWORDS = {
    "A", "I", "AI", "US", "USA", "UK", "EU", "CEO", "CFO", "IPO", "ETF", "GDP",
    "CPI", "FOMC", "FED", "OK", "PM", "AM", "EPS", "PE", "YOY", "QOQ", "ATH",
    "USD", "EUR", "SEC", "IRS", "API", "URL", "FAQ", "TODO", "RSI", "SMA", "EMA",
    "MACD", "ADK", "LLM", "NEWS", "BUY", "SELL", "HOLD", "RISK",
}


def _section(name: str, body: str) -> str:
    body = (body or "").strip()
    if not body:
        return ""
    return f"<memory file=\"{name}\">\n{body}\n</memory>\n"


def held_and_watchlist() -> set[str]:
    """Tickers the brain already tracks (have an asset file)."""
    return set(store.list_assets())


def symbols_from_text(text: str, *, universe: Iterable[str] | None = None) -> list[str]:
    """Extract likely tickers from free text.

    If `universe` is given (e.g. held+watchlist), only return matches within it
    (high precision). Otherwise fall back to the stopword-filtered sniffer.
    """
    if not text:
        return []
    cands = [m.group(1) for m in _TICKER_RE.finditer(text)]
    if universe is not None:
        uni = {u.upper() for u in universe}
        return sorted({c for c in cands if c in uni})
    return sorted({c for c in cands if c not in _STOPWORDS})


def scope_symbols(context: dict[str, Any] | None = None, text: str | None = None) -> list[str]:
    """Resolve the tickers relevant to this run/message."""
    out: list[str] = []
    if context:
        syms = context.get("symbols") or []
        out.extend(str(s).upper() for s in syms if s)
    if text:
        # Prefer tickers we actually track; fall back to the raw sniffer.
        universe = held_and_watchlist()
        out.extend(symbols_from_text(text, universe=universe or None))
    # de-dupe, preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq


def build_context(
    *,
    symbols: Iterable[str] | None = None,
    include_market: bool = True,
    max_chars: int = 6_000,
) -> str:
    """Build the memory block to prepend to a prompt. Empty string if nothing."""
    store.ensure_seeded()
    parts: list[str] = []

    # Always-on identity + book context.
    parts.append(_section("soul.md", store.read("soul.md")))
    parts.append(_section("user.md", store.read("user.md")))
    parts.append(_section("portfolio.md", store.read("portfolio.md")))
    parts.append(_section("lessons.md", store.read("lessons.md")))
    if include_market:
        parts.append(_section("market.md", store.read("market.md")))

    # Scoped asset notes.
    tracked = held_and_watchlist()
    for sym in (s.upper() for s in (symbols or []) if s):
        if sym in tracked:
            parts.append(_section(f"assets/{sym}.md", store.read(f"assets/{sym}.md")))

    block = "".join(p for p in parts if p)
    if not block.strip():
        return ""
    if len(block) > max_chars:
        block = block[:max_chars] + "\n<!-- memory truncated for context budget -->\n"
    return (
        "# COPILOT MEMORY (your persistent brain — use it; do not repeat it verbatim)\n"
        + block
    )

"""
The learning phase — a small "librarian" that runs AFTER the main work is done.

Given what just happened (a cron agent run or a chat exchange), it decides
whether anything durable is worth remembering and, if so, updates the right
memory file(s). It is deliberately cheap (Gemini Flash) and **fail-soft**: no
API key, a bad response, or any exception just means "learned nothing this
time" — it never breaks the run that triggered it.

Design choice: the model returns a validated JSON edit plan; we apply it
deterministically through `tools` (path-guarded, soul.md protected, journal
append-only). We do not hand the model raw filesystem access.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Iterable

from . import store, tools, retrieval

logger = logging.getLogger("memory.curator")

MODEL = os.getenv("MEMORY_MODEL", "gemini-2.5-flash")

# Singletons the curator may rewrite (soul.md excluded; journal is separate).
_ALLOWED_SINGLETONS = store.CURATOR_WRITABLE_SINGLETONS

_CURATOR_SYSTEM = """You are the MEMORY CURATOR for a quant portfolio copilot.
Your only job: after an activity, decide what (if anything) is worth remembering
long-term, and produce a precise edit plan. Be conservative — most routine
activity teaches nothing new. Never invent facts.

You maintain these files (you may ONLY write these):
- user.md       durable facts/preferences about the user
- portfolio.md  the whole-book picture (holdings, allocation, thesis, risks)
- market.md     macro / regime context not tied to one ticker
- lessons.md    durable, repeatable lessons & behavioral patterns (grows slowly)
- watchlist.md  non-held tickers of interest
- assets/<TICKER>.md  per-asset notes (ONLY for tickers in the allowed list)
You may NEVER write soul.md.

RULES
- Only record information that is DURABLE and NOT already captured. Skip prices,
  one-off numbers, and restatements of what the file already says.
- When you update a file, return its FULL new markdown content (you are given the
  current content to edit). Preserve the existing section structure. Keep each
  file concise (well under 8000 characters) — summarize, don't append forever.
- Reconcile: correct stale facts in place rather than piling on contradictions.
- For a per-asset insight, write assets/<TICKER>.md — but ONLY if TICKER is in the
  allowed_assets list. Otherwise skip it.
- Always produce a one-line `journal` entry summarizing what happened (or null if
  truly nothing occurred).

Return ONLY JSON of this exact shape:
{
  "journal": "one concise line, or null",
  "updates": [
    { "file": "portfolio.md", "content": "<full new markdown>" }
  ],
  "reason": "one line on what you learned, or why nothing"
}
If nothing durable was learned, return {"journal": <line or null>, "updates": [], "reason": "..."}.
"""


def _genai_json(prompt: str) -> dict[str, Any] | None:
    """One synchronous Flash call returning parsed JSON, or None on any failure."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.info("curator skipped: GEMINI_API_KEY not set")
        return None
    try:
        from google import genai  # local import; optional dep
    except Exception as e:  # noqa: BLE001
        logger.info("curator skipped: google-genai unavailable (%s)", e)
        return None
    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(resp.text)
    except Exception as e:  # noqa: BLE001
        logger.warning("curator LLM/parse failed: %s", e)
        return None


def _current_memory_digest(symbols: Iterable[str]) -> str:
    """The memory the curator edits against — current content of writable files."""
    parts = [f"### {n}\n{store.read(n)}" for n in
             ("user.md", "portfolio.md", "market.md", "lessons.md", "watchlist.md")]
    tracked = retrieval.held_and_watchlist()
    for s in symbols:
        if s in tracked:
            parts.append(f"### assets/{s}.md\n{store.read(f'assets/{s}.md')}")
    return "\n\n".join(parts)


def _apply_plan(plan: dict[str, Any], allowed_assets: set[str]) -> list[str]:
    """Validate + apply an edit plan. Returns the list of files actually written."""
    written: list[str] = []

    journal = plan.get("journal")
    if isinstance(journal, str) and journal.strip():
        tools.append_journal(journal)

    for upd in plan.get("updates") or []:
        if not isinstance(upd, dict):
            continue
        raw_file = str(upd.get("file") or "").strip()
        content = upd.get("content")
        if not raw_file or not isinstance(content, str) or not content.strip():
            continue
        try:
            canonical = store.normalize_name(raw_file)
        except ValueError:
            logger.info("curator: rejected file name %r", raw_file)
            continue

        if canonical == "soul.md" or canonical == "journal.md":
            continue  # protected / append-only
        if canonical.startswith("assets/"):
            ticker = canonical[len("assets/"):-3]
            if ticker not in allowed_assets:
                logger.info("curator: skip asset %s (not in allowed set)", ticker)
                continue
        elif canonical not in _ALLOWED_SINGLETONS:
            continue

        try:
            tools.apply_update(file=canonical, content=content, actor="agent")
            written.append(canonical)
        except Exception as e:  # noqa: BLE001
            logger.warning("curator: failed writing %s: %s", canonical, e)
    return written


def reflect_and_learn(
    *,
    source: str,
    activity: str,
    symbols: Iterable[str] | None = None,
) -> dict[str, Any] | None:
    """Core entry point. `activity` is a plain-text description of what happened.

    Returns a small dict describing what was learned, or None if it no-op'd or
    failed. Never raises.
    """
    try:
        symbols = sorted({str(s).upper() for s in (symbols or []) if s})
        if not activity or not activity.strip():
            return None

        store.ensure_seeded()
        allowed_assets = set(symbols) | retrieval.held_and_watchlist()

        prompt = (
            _CURATOR_SYSTEM
            + f"\n\nSOURCE: {source}"
            + f"\nALLOWED_ASSETS (only these tickers may get an asset file): "
            + (", ".join(sorted(allowed_assets)) or "(none)")
            + "\n\n=== WHAT JUST HAPPENED ===\n"
            + activity.strip()[:8000]
            + "\n\n=== CURRENT MEMORY (edit against this) ===\n"
            + _current_memory_digest(symbols)[:12000]
        )

        plan = _genai_json(prompt)
        if not plan or not isinstance(plan, dict):
            return None

        written = _apply_plan(plan, allowed_assets)
        result = {
            "source": source,
            "written": written,
            "reason": plan.get("reason"),
            "journaled": bool(plan.get("journal")),
        }
        if written or plan.get("journal"):
            logger.info("curator learned: %s", result)
        return result
    except Exception as e:  # noqa: BLE001 — learning must never break a run
        logger.warning("curator reflect_and_learn failed: %s", e)
        return None


# ── Convenience adapters for the two call sites ───────────────────────

def curate_from_run(
    *,
    agent_type: str,
    context: dict[str, Any] | None,
    output_dict: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any] | None:
    """Learning hook for cron / manual agent runs (called from _persist_run)."""
    context = context or {}
    symbols = context.get("symbols") or []
    if error and not output_dict:
        # A pure failure — record a terse journal note, nothing to learn.
        try:
            store.ensure_seeded()
            tools.append_journal(f"{agent_type} run failed: {str(error)[:200]}")
        except Exception:  # noqa: BLE001
            pass
        return None

    out = output_dict or {}
    findings = out.get("findings") or []
    recs = out.get("recommendations") or []
    lines = [
        f"Agent: {agent_type}",
        f"Symbols: {', '.join(map(str, symbols)) or 'n/a'}",
        f"Overall signal: {out.get('overall_signal')} (confidence {out.get('overall_confidence')})",
        f"Summary: {out.get('summary') or '(none)'}",
    ]
    if findings:
        lines.append("Findings:")
        for f in findings[:8]:
            lines.append(
                f"  - [{f.get('signal')}/{f.get('impact')}] {f.get('title')}: {f.get('description')}"
            )
    if recs:
        lines.append("Recommendations:")
        for r in recs[:8]:
            lines.append(f"  - {r.get('action')} {r.get('symbol')}: {r.get('reasoning')}")
    return reflect_and_learn(source=f"cron:{agent_type}", activity="\n".join(lines), symbols=symbols)


def curate_from_chat(
    *,
    message: str,
    response: str,
    symbols: Iterable[str] | None = None,
) -> dict[str, Any] | None:
    """Learning hook for chat (called after a response is produced)."""
    syms = list(symbols or []) or retrieval.scope_symbols(text=f"{message}\n{response}")
    activity = f"User said:\n{message}\n\nCopilot replied:\n{response}"
    return reflect_and_learn(source="chat", activity=activity, symbols=syms)

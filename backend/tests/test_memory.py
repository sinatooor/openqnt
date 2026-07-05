"""
Tests for the copilot memory brain + learning phase.

Covers: default seeding, path/name guarding, agent write policy, journal
rolling, reset-to-default, scoped retrieval, and the curator's edit-plan
application (with the LLM call mocked — no network).
"""

from __future__ import annotations

import pytest

from memory import store, retrieval, curator, tools


@pytest.fixture()
def mem(tmp_path, monkeypatch):
    """Point the store at an isolated tmp memory root and seed it."""
    monkeypatch.setattr(store, "MEMORY_ROOT", tmp_path / "memory")
    store.ensure_seeded()
    return tmp_path / "memory"


# ── seeding & defaults ────────────────────────────────────────────────

def test_seeded_defaults_exist(mem):
    for name in ("soul.md", "user.md", "portfolio.md", "watchlist.md",
                 "market.md", "lessons.md", "journal.md"):
        assert (mem / name).exists(), f"{name} not seeded"
    assert "quant portfolio copilot" in store.read("soul.md")
    assert (mem / "assets").is_dir()


# ── name normalization / guarding ─────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("portfolio.md", "portfolio.md"),
    ("portfolio", "portfolio.md"),
    ("AAPL", "assets/AAPL.md"),
    ("aapl", "assets/AAPL.md"),
    ("assets/nvda.md", "assets/NVDA.md"),
    ("BRK.B", "assets/BRK.B.md"),
])
def test_normalize_name_ok(mem, raw, expected):
    assert store.normalize_name(raw) == expected


@pytest.mark.parametrize("bad", [
    "../secrets", "/etc/passwd", "assets/../soul", "",
    "waytoolongtickername",  # >12 chars, not a singleton → invalid ticker
    "9NVDA",                 # starts with a digit → invalid ticker
    "assets/1BADTICK.md",    # asset with an invalid ticker
])
def test_normalize_name_rejects_unsafe(mem, bad):
    with pytest.raises(ValueError):
        store.normalize_name(bad)


def test_bare_alnum_is_treated_as_ticker(mem):
    # A short bare alphanumeric name is intentionally an asset file.
    assert store.normalize_name("notafile") == "assets/NOTAFILE.md"


# ── agent write policy ────────────────────────────────────────────────

def test_agent_cannot_write_soul(mem):
    with pytest.raises(PermissionError):
        store.write_checked("soul.md", "hacked", actor="agent")


def test_agent_cannot_write_journal_directly(mem):
    with pytest.raises(PermissionError):
        store.write_checked("journal.md", "x", actor="agent")


def test_agent_can_write_portfolio_and_assets(mem):
    store.write_checked("portfolio.md", "# Portfolio\nnew", actor="agent")
    assert "new" in store.read("portfolio.md")
    tools.apply_update(file="AAPL", content="# AAPL\nthesis", actor="agent")
    assert "thesis" in store.read("assets/AAPL.md")


def test_user_can_write_anything(mem):
    store.write("soul.md", "# Soul\nmy own voice")  # actor=user path
    assert "my own voice" in store.read("soul.md")


# ── journal rolling ───────────────────────────────────────────────────

def test_journal_appends_and_rolls(mem):
    for i in range(store.MAX_JOURNAL_ENTRIES + 15):
        store.append_journal(f"entry {i}")
    text = store.read("journal.md")
    lines = [ln for ln in text.splitlines() if ln.lstrip().startswith("- ")]
    assert len(lines) == store.MAX_JOURNAL_ENTRIES
    assert "# Journal" in text  # header preserved
    assert f"entry {store.MAX_JOURNAL_ENTRIES + 14}" in text  # newest kept
    assert "entry 0" not in text  # oldest rolled off


def test_write_over_hard_cap_truncates_and_read_returns_canonical(mem):
    big = "x" * (store.HARD_CAP_CHARS + 500)
    store.write("portfolio.md", big)
    stored = store.read("portfolio.md")
    assert len(stored) < len(big)
    assert "truncated: exceeded memory size cap" in stored
    # Clients must render read-back (canonical) content, not their draft —
    # the PUT route returns store.read() for exactly this reason.


def test_list_assets_excludes_invalid_ticker_files(mem):
    store.ensure_asset("AAPL")
    # A stray hand-dropped file whose stem is not a valid ticker.
    (mem / "assets" / "foo bar.md").write_text("junk", encoding="utf-8")
    assert store.list_assets() == ["AAPL"]
    advertised = [f["name"] for f in store.list_files()]
    assert "assets/AAPL.md" in advertised
    assert all("foo bar" not in n for n in advertised)


# ── reset to default ──────────────────────────────────────────────────

def test_reset_to_default(mem):
    store.write("user.md", "totally custom")
    assert "totally custom" in store.read("user.md")
    store.reset_to_default("user.md")
    assert "About You" in store.read("user.md")
    assert "totally custom" not in store.read("user.md")


# ── retrieval ─────────────────────────────────────────────────────────

def test_build_context_includes_core_and_scoped_asset(mem):
    tools.apply_update(file="AAPL", content="# AAPL\nHeld since Jan.", actor="agent")
    ctx = retrieval.build_context(symbols=["AAPL", "TSLA"])  # only AAPL tracked
    assert 'file="soul.md"' in ctx
    assert 'file="portfolio.md"' in ctx
    assert 'file="assets/AAPL.md"' in ctx
    assert "Held since Jan." in ctx
    assert 'file="assets/TSLA.md"' not in ctx  # not tracked → not injected


def test_build_context_empty_when_no_root(monkeypatch, tmp_path):
    # Even with a fresh root, seeding gives non-empty identity context.
    monkeypatch.setattr(store, "MEMORY_ROOT", tmp_path / "m2")
    ctx = retrieval.build_context(symbols=[])
    assert "COPILOT MEMORY" in ctx


def test_scope_symbols_from_text_prefers_tracked(mem):
    tools.apply_update(file="NVDA", content="# NVDA", actor="agent")
    syms = retrieval.scope_symbols(text="I think NVDA and THE FED look strong")
    assert "NVDA" in syms
    assert "THE" not in syms and "FED" not in syms


# ── curator (LLM mocked) ──────────────────────────────────────────────

def test_curator_applies_valid_plan(mem, monkeypatch):
    plan = {
        "journal": "Reviewed AAPL earnings; raised conviction.",
        "updates": [
            {"file": "assets/AAPL.md", "content": "# AAPL\n## Thesis\nStrong services growth."},
            {"file": "portfolio.md", "content": "# Portfolio\nTech-heavy, watching concentration."},
            {"file": "soul.md", "content": "SHOULD BE REJECTED"},
            {"file": "assets/ZZZZ.md", "content": "not in allowed set"},
        ],
        "reason": "learned AAPL thesis",
    }
    monkeypatch.setattr(curator, "_genai_json", lambda prompt: plan)

    result = curator.reflect_and_learn(source="test", activity="AAPL earnings review", symbols=["AAPL"])
    assert result is not None
    assert "assets/AAPL.md" in result["written"]
    assert "portfolio.md" in result["written"]
    assert "soul.md" not in result["written"]          # protected
    assert "assets/ZZZZ.md" not in result["written"]   # not in allowed_assets

    assert "Strong services growth." in store.read("assets/AAPL.md")
    assert "SHOULD BE REJECTED" not in store.read("soul.md")
    assert "raised conviction" in store.read("journal.md")


def test_curator_noop_on_none(mem, monkeypatch):
    monkeypatch.setattr(curator, "_genai_json", lambda prompt: None)
    assert curator.reflect_and_learn(source="test", activity="nothing", symbols=[]) is None


def test_curate_from_run_failure_journals_and_returns_none(mem, monkeypatch):
    # A pure failure records a terse journal note and does not call the LLM.
    called = {"llm": False}
    monkeypatch.setattr(curator, "_genai_json", lambda p: called.__setitem__("llm", True))
    out = curator.curate_from_run(
        agent_type="news_analyst",
        context={"symbols": ["AAPL"]},
        output_dict=None,
        error="boom",
    )
    assert out is None
    assert called["llm"] is False
    assert "news_analyst run failed" in store.read("journal.md")

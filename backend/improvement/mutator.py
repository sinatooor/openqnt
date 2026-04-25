"""
Mutator — propose the next set of `BacktestSpec`s to try.

Two backends, picked at runtime:

  * **heuristic** (always available) — perturbs the seed's `params`
    along strategy-specific axes. For `rsi_meanrev`: nudges
    `rsi_period` ± {2, 4}, `oversold` ± {3, 5}, `overbought` ∓ {3, 5}.
    For `sma_crossover`: nudges `fast` and `slow`. Avoids re-proposing
    specs already in `history`.

  * **llm** (Gemini, optional) — prompts the model with the full
    history of `(params, score)` and asks for the next params dict.
    Only used when `GEMINI_API_KEY` is set; falls back to heuristic on
    any error so the loop never stalls.

The mutator is intentionally cheap: it only produces *candidate
specs*. The runner is responsible for actually running them.
"""
from __future__ import annotations

import json
import os
import random
from typing import Iterable, Optional

from backtest import BacktestSpec


# ── public ────────────────────────────────────────────────────


def propose_mutations(
    seed: BacktestSpec,
    history: list[tuple[BacktestSpec, dict, float]],
    n: int = 4,
    rng: Optional[random.Random] = None,
) -> list[BacktestSpec]:
    """Return up to `n` distinct candidate specs for the next iteration.

    `history` is `[(spec, metrics, score)]` for every node already
    explored, ordered oldest-first. The seed itself is in there at
    index 0.
    """
    rng = rng or random.Random(0)
    explored = {_param_key(s.params) for s, _, _ in history}

    if os.getenv("GEMINI_API_KEY") and len(history) >= 2:
        try:
            llm = _llm_proposals(seed, history, n)
            llm = [c for c in llm if _param_key(c.params) not in explored]
            if llm:
                return llm[:n]
        except Exception:
            pass

    return _heuristic_proposals(seed, history, n, explored, rng)


# ── heuristic ────────────────────────────────────────────────


def _heuristic_proposals(
    seed: BacktestSpec,
    history: list[tuple[BacktestSpec, dict, float]],
    n: int,
    explored: set,
    rng: random.Random,
) -> list[BacktestSpec]:
    # Centre the search around the *current best* so the loop walks
    # towards better regions instead of always orbiting the seed.
    best_spec = max(history, key=lambda h: h[2])[0] if history else seed
    base_params = dict(best_spec.params)

    candidates: list[BacktestSpec] = []
    deltas = _strategy_deltas(seed.strategy)
    if not deltas:
        return []

    # Generate a few neighbours, then sample randomly without
    # replacement up to `n`.
    neighbours: list[dict] = []
    for axis, options in deltas.items():
        if axis not in base_params:
            continue
        cur = base_params[axis]
        for d in options:
            if isinstance(cur, int):
                neighbours.append({**base_params, axis: max(2, cur + d)})
            else:
                neighbours.append({**base_params, axis: float(cur) + d})
    # Mix in a couple of two-axis nudges for variety.
    if len(deltas) >= 2:
        axes = list(deltas.keys())
        for _ in range(4):
            a, b = rng.sample(axes, 2)
            if a not in base_params or b not in base_params:
                continue
            mut = dict(base_params)
            mut[a] = max(2, base_params[a] + rng.choice(deltas[a]))
            mut[b] = max(2, base_params[b] + rng.choice(deltas[b]))
            neighbours.append(mut)

    rng.shuffle(neighbours)
    for params in neighbours:
        # Sanity: rsi oversold < overbought, sma fast < slow.
        if not _params_sane(seed.strategy, params):
            continue
        key = _param_key(params)
        if key in explored:
            continue
        explored.add(key)
        candidates.append(_replace_params(seed, params))
        if len(candidates) >= n:
            break
    return candidates


def _strategy_deltas(strategy: str) -> dict[str, list]:
    if strategy == "rsi_meanrev":
        return {
            "rsi_period": [-4, -2, 2, 4, 7],
            "oversold":   [-5, -3, 3, 5],
            "overbought": [-5, -3, 3, 5],
        }
    if strategy == "sma_crossover":
        return {
            "fast": [-10, -5, 5, 10, 20],
            "slow": [-50, -20, 20, 50],
        }
    return {}


def _params_sane(strategy: str, p: dict) -> bool:
    if strategy == "rsi_meanrev":
        if p.get("oversold", 30) >= p.get("overbought", 70):
            return False
        if not (1 <= p.get("oversold", 30) <= 49):
            return False
        if not (51 <= p.get("overbought", 70) <= 99):
            return False
        if not (2 <= p.get("rsi_period", 14) <= 60):
            return False
    if strategy == "sma_crossover":
        if p.get("fast", 10) >= p.get("slow", 30):
            return False
        if p.get("fast", 10) < 2 or p.get("slow", 30) > 400:
            return False
    return True


# ── LLM ──────────────────────────────────────────────────────


def _llm_proposals(seed: BacktestSpec, history: list, n: int) -> list[BacktestSpec]:
    """Ask Gemini for the next params dict(s). Free-form parsing — we
    accept whatever JSON list comes back as long as items look like
    `{params: {...}}` or just `{...}`.
    """
    from google import genai  # lazy import; only loaded when key is set

    client = genai.Client()
    rows = "\n".join(
        f"  - params={json.dumps(s.params)}  → "
        f"sharpe={m.get('sharpe', 0):.2f}  dd={m.get('max_drawdown_pct', 0):.1f}%  "
        f"score={score:.3f}"
        for s, m, score in history[-12:]
    )
    deltas = _strategy_deltas(seed.strategy)
    prompt = f"""You are an algorithmic-trading researcher tuning a strategy.

Strategy: {seed.strategy}
Symbol: {seed.symbol}, window: {seed.start} → {seed.end}
Tunable params + nudge axes:
{json.dumps(deltas, indent=2)}

History (oldest → newest), score = sharpe with a max-drawdown brake:
{rows}

Propose {n} new param sets to try next. Return ONLY a JSON list of dicts,
each being just the `params` dict (no extra wrapping). No commentary.
Avoid duplicates from history."""

    resp = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001"),
        contents=prompt,
    )
    txt = (resp.text or "").strip()
    # Strip markdown fences if present.
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt.startswith("json"):
            txt = txt[4:]
    txt = txt.strip()
    parsed = json.loads(txt)
    if not isinstance(parsed, list):
        return []
    out: list[BacktestSpec] = []
    for entry in parsed[:n]:
        params = entry.get("params") if isinstance(entry, dict) and "params" in entry else entry
        if not isinstance(params, dict):
            continue
        # Coerce ints where the seed used ints.
        merged = dict(seed.params)
        for k, v in params.items():
            if k in merged and isinstance(merged[k], int):
                try:
                    merged[k] = int(v)
                except Exception:
                    continue
            else:
                merged[k] = v
        if _params_sane(seed.strategy, merged):
            out.append(_replace_params(seed, merged))
    return out


# ── helpers ──────────────────────────────────────────────────


def _param_key(params: dict) -> str:
    return json.dumps(params, sort_keys=True)


def _replace_params(seed: BacktestSpec, params: dict) -> BacktestSpec:
    return BacktestSpec(
        symbol=seed.symbol,
        start=seed.start,
        end=seed.end,
        interval=seed.interval,
        initial_cash=seed.initial_cash,
        commission=seed.commission,
        strategy=seed.strategy,
        params=params,
        code=seed.code,
        save_artifacts=False,  # the improvement runner handles persistence
        run_id=None,
    )

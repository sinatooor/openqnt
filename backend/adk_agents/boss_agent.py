"""
Boss Agent — hierarchical orchestrator for Phase C.

The Boss:
  1. Accepts a high-level objective from the user.
  2. Uses an LLM to produce a plan: a list of Subtask{agent, prompt, expected_output}.
  3. Dispatches those subtasks to the registered quant agents in parallel, each
     with its own AgentRunContext (so every sub-run shows up under
     agents/quants/<agent_id>/runs/<sub_run_id>/ with the usual events.jsonl,
     plots/, artifacts/, summary.md).
  4. Aggregates the outputs by delegating to the `synthesis_agent`.
  5. Decides next action (refine / execute / spawn new task) — currently
     returned as part of the boss run's conclusion.

The boss itself emits stream events on its own run (agent_id="boss") so the
frontend can render a live tree:
  • `plan` event carries the Subtask list
  • `subtask` event is emitted once per dispatched sub-run (carries
    sub_agent_id + sub_run_id so the UI can open the detail panel)
  • `subtask_result` event is emitted when each sub-run completes
  • `synthesis` event carries the synthesis_agent output
  • final `message` + ctx.finish() carries the boss conclusion

Run directory:
  agents/boss/runs/<run_id>/
    events.jsonl
    run.json
    summary.md
    artifacts/plan.json
    artifacts/synthesis.json
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

from google import genai

from .base_agent import AgentOutput, SignalType
from .synthesis_agent import synthesis_agent


# ── Registry of dispatchable quant agents ─────────────────────────────
# Imported lazily so this module can be imported even if some agent
# modules fail to load (e.g. missing optional deps).

def _quant_registry() -> dict[str, Any]:
    reg: dict[str, Any] = {}
    try:
        from .news_analyst import news_analyst
        reg["news_analyst"] = news_analyst
    except Exception:
        pass
    try:
        from .macro_analyst import macro_analyst
        reg["macro_analyst"] = macro_analyst
    except Exception:
        pass
    try:
        from .social_monitor import social_monitor
        reg["social_monitor"] = social_monitor
    except Exception:
        pass
    try:
        from .technical_analyst import technical_analyst
        reg["technical_analyst"] = technical_analyst
    except Exception:
        pass
    try:
        from .fundamentals_agent import fundamentals_agent
        reg["fundamentals_agent"] = fundamentals_agent
    except Exception:
        pass
    try:
        from .sentiment_agent import sentiment_agent
        reg["sentiment_agent"] = sentiment_agent
    except Exception:
        pass
    return reg


@dataclass
class Subtask:
    agent: str                       # backend agent_id, e.g. "technical_analyst"
    prompt: str                      # human-readable directive
    expected_output: str = ""        # what the boss hopes to get back
    symbols: list[str] = field(default_factory=list)
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class SubtaskResult:
    subtask: Subtask
    sub_run_id: str
    status: str                      # "success" | "error"
    output: dict[str, Any] | None = None
    error: str | None = None


PLAN_PROMPT = """You are the Boss of a quant research team. You receive a high-level
objective from the user and must decompose it into concrete subtasks that are
dispatched to specialist quant agents in parallel.

AVAILABLE AGENTS:
{agent_catalog}

USER OBJECTIVE:
{objective}

PORTFOLIO SYMBOLS: {symbols}

Produce a plan that covers the objective from multiple angles. Each subtask
should be concrete, scoped to ONE agent, and produce an output that can be
combined with the others. Prefer 3–5 subtasks; avoid redundant work.

Respond in EXACTLY this JSON shape:
{{
    "rationale": "1-2 sentence strategy for how the subtasks cover the objective",
    "subtasks": [
        {{
            "agent": "<agent_id from AVAILABLE AGENTS>",
            "prompt": "What you want this agent to do, in plain English",
            "expected_output": "What usable signal / insight you expect back",
            "symbols": ["AAPL", "MSFT"]
        }}
    ]
}}

Rules:
- Only use agents that exist in AVAILABLE AGENTS.
- If the objective doesn't need a given agent, omit it — don't fill quota.
- If only one agent fits, return one subtask.
"""


class BossAgent:
    """Dispatches subtasks to quant agents in parallel and synthesises results."""

    agent_type = "boss"
    description = "Hierarchical boss: plans, dispatches quants in parallel, synthesises results"

    def __init__(self) -> None:
        self._registry: dict[str, Any] | None = None

    @property
    def registry(self) -> dict[str, Any]:
        if self._registry is None:
            self._registry = _quant_registry()
        return self._registry

    # ── planning ──────────────────────────────────────────────────────

    async def plan(
        self,
        objective: str,
        symbols: list[str],
        model: str = "gemini-2.5-flash",
    ) -> tuple[str, list[Subtask]]:
        catalog_lines = [
            f"- {aid}: {getattr(agent, 'description', aid)}"
            for aid, agent in sorted(self.registry.items())
        ]
        prompt = PLAN_PROMPT.format(
            agent_catalog="\n".join(catalog_lines) or "(none)",
            objective=objective,
            symbols=", ".join(symbols) if symbols else "(none)",
        )

        client = genai.Client()
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        try:
            plan = json.loads(response.text or "{}")
        except json.JSONDecodeError:
            plan = {"rationale": "LLM returned non-JSON; falling back.", "subtasks": []}

        rationale = plan.get("rationale", "")
        raw_subtasks = plan.get("subtasks", []) or []
        subtasks: list[Subtask] = []
        for st in raw_subtasks:
            agent_id = st.get("agent")
            if agent_id not in self.registry:
                continue
            subtasks.append(Subtask(
                agent=agent_id,
                prompt=st.get("prompt", ""),
                expected_output=st.get("expected_output", ""),
                symbols=st.get("symbols", []) or symbols,
            ))

        # Fallback: if the LLM produced nothing usable, dispatch to every
        # registered agent with the raw objective so the Boss still does work.
        if not subtasks and self.registry:
            subtasks = [
                Subtask(agent=aid, prompt=objective, symbols=symbols)
                for aid in self.registry
            ]
            rationale = rationale or "Fallback: dispatched to every agent."

        return rationale, subtasks

    # ── dispatch ──────────────────────────────────────────────────────

    async def _run_subtask(self, sub: Subtask, model: str | None) -> SubtaskResult:
        """Runs a single subtask inside its own AgentRunContext."""
        from agent_runtime import AgentRunContext  # local import

        agent = self.registry.get(sub.agent)
        if agent is None:
            return SubtaskResult(
                subtask=sub,
                sub_run_id="",
                status="error",
                error=f"Unknown agent {sub.agent}",
            )

        ctx = AgentRunContext(
            agent_id=sub.agent,
            task=sub.prompt or f"{sub.agent} subtask",
            symbols=sub.symbols,
            model=model,
        )

        # Build the analyze() context in the shape each agent expects.
        analyze_ctx: dict[str, Any] = {
            "symbols": sub.symbols,
            "model": model,
            "task": sub.prompt,
            "boss_prompt": sub.prompt,
            "expected_output": sub.expected_output,
            **sub.context,
        }

        try:
            out: AgentOutput = await agent.run(analyze_ctx, ctx)
            status = "error" if out.error else "success"
            ctx.finish(
                status=status,
                conclusion=out.summary or None,
                signal=out.overall_signal.value if out.overall_signal else None,
                confidence=out.overall_confidence,
                error=out.error,
            )
            return SubtaskResult(
                subtask=sub,
                sub_run_id=ctx.run_id,
                status=status,
                output=out.to_dict(),
                error=out.error,
            )
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"
            ctx.finish(status="error", error=err)
            return SubtaskResult(
                subtask=sub,
                sub_run_id=ctx.run_id,
                status="error",
                error=err,
            )

    # ── full run ──────────────────────────────────────────────────────

    async def run(
        self,
        objective: str,
        symbols: list[str] | None = None,
        model: str | None = "gemini-2.5-flash",
        ctx=None,
    ) -> dict[str, Any]:
        """
        Run one complete boss cycle. `ctx` is the boss's own AgentRunContext.
        Returns a dict with {rationale, subtasks, results, synthesis}.
        """
        from agent_runtime import AgentRunContext  # local import

        symbols = symbols or []
        own_ctx = False
        if ctx is None:
            ctx = AgentRunContext(
                agent_id="boss",
                task=objective,
                symbols=symbols,
                model=model,
            )
            own_ctx = True

        try:
            # 1. Plan
            ctx.status("Planning subtasks…")
            rationale, subtasks = await self.plan(objective, symbols, model or "gemini-2.5-flash")
            plan_payload = {
                "rationale": rationale,
                "subtasks": [asdict(s) for s in subtasks],
            }
            ctx.save_json("plan.json", plan_payload, caption="Boss plan")
            ctx._emit(
                "plan",
                text=rationale,
                plan=plan_payload,
            )

            if not subtasks:
                conclusion = "No dispatchable subtasks — no registered agents or empty plan."
                ctx.message(conclusion)
                if own_ctx:
                    ctx.finish(status="success", conclusion=conclusion)
                return {
                    "rationale": rationale,
                    "subtasks": [],
                    "results": [],
                    "synthesis": None,
                    "run_id": ctx.run_id,
                }

            # 2. Emit a "subtask dispatched" event per subtask so the UI can
            #    render placeholders in the tree before the sub-runs finish.
            #    The sub_run_id isn't known yet, so we resolve it after creation.

            async def _wrap(sub: Subtask) -> SubtaskResult:
                # Emit dispatch event BEFORE the sub-ctx is created so the UI
                # shows a pending node immediately. The real sub_run_id is
                # emitted again on completion via subtask_result.
                ctx._emit(
                    "subtask",
                    text=f"→ {sub.agent}: {sub.prompt[:120]}",
                    subAgentId=sub.agent,
                    subStatus="pending",
                    subPrompt=sub.prompt,
                    subSymbols=sub.symbols,
                    subExpected=sub.expected_output,
                )
                result = await self._run_subtask(sub, model)
                ctx._emit(
                    "subtask_result",
                    text=f"← {sub.agent}: {result.status}",
                    subAgentId=sub.agent,
                    subRunId=result.sub_run_id,
                    subStatus=result.status,
                    subError=result.error,
                    subSummary=(result.output or {}).get("summary"),
                    subSignal=(result.output or {}).get("overall_signal"),
                    subConfidence=(result.output or {}).get("overall_confidence"),
                )
                return result

            # 3. Dispatch in parallel
            ctx.status(f"Dispatching {len(subtasks)} subtasks in parallel…")
            results: list[SubtaskResult] = await asyncio.gather(
                *[_wrap(s) for s in subtasks],
                return_exceptions=False,
            )

            # 4. Synthesis
            ctx.status("Synthesising analyst outputs…")
            agent_outputs = [r.output for r in results if r.output]
            synth: dict[str, Any] | None = None
            if agent_outputs:
                try:
                    synth_out = await synthesis_agent.run({
                        "symbols": symbols,
                        "agent_outputs": agent_outputs,
                        "model": model or "gemini-2.5-flash",
                    })
                    synth = synth_out.to_dict()
                    ctx.save_json("synthesis.json", synth, caption="Synthesis")
                    ctx._emit(
                        "synthesis",
                        text=synth.get("summary") or "(no summary)",
                        synthesis=synth,
                    )
                except Exception as e:  # noqa: BLE001
                    ctx.error_event(f"Synthesis failed: {e}")

            # 5. Conclusion
            summary = (synth or {}).get("summary") or "Boss cycle complete."
            signal = (synth or {}).get("overall_signal")
            confidence = (synth or {}).get("overall_confidence")
            ctx.message(summary)

            if own_ctx:
                ctx.finish(
                    status="success",
                    conclusion=summary,
                    signal=signal,
                    confidence=confidence,
                )

            return {
                "run_id": ctx.run_id,
                "rationale": rationale,
                "subtasks": [asdict(s) for s in subtasks],
                "results": [
                    {
                        "agent": r.subtask.agent,
                        "sub_run_id": r.sub_run_id,
                        "status": r.status,
                        "error": r.error,
                        "output": r.output,
                    }
                    for r in results
                ],
                "synthesis": synth,
            }

        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"
            if own_ctx:
                ctx.finish(status="error", error=err)
            return {
                "run_id": ctx.run_id,
                "rationale": "",
                "subtasks": [],
                "results": [],
                "synthesis": None,
                "error": err,
            }


# Singleton
boss_agent = BossAgent()

__all__ = ["BossAgent", "boss_agent", "Subtask", "SubtaskResult"]

"""
agent_scheduler — background poller that fires `scheduled_agents` rows.

Mirrors the threading model of `market_data_scheduler.py` (daemon
thread + stop event + ~30s tick) so we don't pull in APScheduler/Celery
just for this. Each fire is an async agent.run() driven through a
short-lived event loop owned by the scheduler thread.

What it does each tick:
  1. Read `scheduled_agents` rows whose next_run_at <= now AND enabled=1
  2. For each due row: run the agent with the stored context, persist
     the result into `agent_runs` (via `agent_runner._persist_run`),
     bump `last_run_at` + `next_run_at` (= now + interval_minutes)
  3. Sleep ~30s, repeat

Failures on one row do not affect siblings. Errors are stored on the
schedule row's `last_error` so the UI can surface them.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any, Dict

logger = logging.getLogger("agent_scheduler")

_TICK_SECONDS = 30

_started = False
_thread: threading.Thread | None = None
_stop = threading.Event()


def _run_one(loop: asyncio.AbstractEventLoop, sched: Dict[str, Any]) -> None:
    """Fire a single scheduled agent. Best-effort — never raises."""
    from routers.agent_runner import AGENT_REGISTRY, _persist_run
    from services import agent_runs_db

    sid = sched["id"]
    agent_type = sched["agent_type"]
    agent = AGENT_REGISTRY.get(agent_type)
    if agent is None:
        agent_runs_db.mark_schedule_fired(
            sid, status="error", error=f"unknown agent_type {agent_type}",
        )
        return

    context: Dict[str, Any] = dict(sched.get("context") or {})
    if sched.get("symbols"):
        context.setdefault("symbols", sched["symbols"])

    try:
        output = loop.run_until_complete(agent.run(context))
        output_dict = output.to_dict() if hasattr(output, "to_dict") else dict(output)
        err = output_dict.get("error")
        _persist_run(
            agent_type=agent_type, context=context,
            output_dict=output_dict, error=err, schedule_id=sid,
        )
        agent_runs_db.mark_schedule_fired(
            sid, status="error" if err else "success", error=err,
        )
    except Exception as e:  # noqa: BLE001
        msg = f"{type(e).__name__}: {e}"
        logger.exception("scheduled agent fire failed sid=%s", sid)
        _persist_run(agent_type=agent_type, context=context, error=msg, schedule_id=sid)
        agent_runs_db.mark_schedule_fired(sid, status="error", error=msg)


def _scheduler_loop() -> None:
    from services import agent_runs_db

    logger.info("agent scheduler started (tick=%ds)", _TICK_SECONDS)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        while not _stop.is_set():
            try:
                due = agent_runs_db.due_schedules()
            except Exception as e:  # noqa: BLE001
                logger.warning("due_schedules() failed: %s", e)
                due = []

            for sched in due:
                if _stop.is_set():
                    break
                _run_one(loop, sched)

            # Sleep TICK in 1s slices so stop() is responsive.
            for _ in range(_TICK_SECONDS):
                if _stop.is_set():
                    break
                time.sleep(1)
    finally:
        try:
            loop.close()
        except Exception:
            pass
        logger.info("agent scheduler stopped")


def start_scheduler() -> bool:
    """Idempotent start. Safe to call from FastAPI startup."""
    global _started, _thread
    if _started:
        return True
    _stop.clear()
    _thread = threading.Thread(
        target=_scheduler_loop, daemon=True, name="agent-scheduler",
    )
    _thread.start()
    _started = True
    return True


def stop_scheduler() -> None:
    global _started
    if not _started:
        return
    _stop.set()
    _started = False

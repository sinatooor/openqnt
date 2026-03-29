"""
ADK Web entry point — Synthesis Agent

Final decision-maker that aggregates all specialist agent outputs
into a unified buy/sell/hold action plan.
"""
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from adk_agents.synthesis_agent import synthesis_agent as root_agent  # noqa: E402

__all__ = ["root_agent"]

"""
ADK Web entry point — Trading Agent

Exposes the main trading agent as root_agent so `adk web` can load it.
sys.path is extended so that backend packages (adk_agents, tools, etc.) are importable.
"""
import sys
from pathlib import Path

# Add backend/ to path so all backend modules are importable
_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from adk_agents.trading_agent import trading_agent as root_agent  # noqa: E402

__all__ = ["root_agent"]

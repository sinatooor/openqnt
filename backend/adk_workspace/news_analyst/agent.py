"""
ADK Web entry point — News Analyst Agent

Scans financial news, extracts sentiment signals, and scores impact per symbol.
"""
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from adk_agents.news_analyst import news_analyst as root_agent  # noqa: E402

__all__ = ["root_agent"]

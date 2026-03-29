"""ADK Web entry point — Social Monitor Agent"""
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from adk_agents.social_monitor import social_monitor as root_agent  # noqa: E402

__all__ = ["root_agent"]

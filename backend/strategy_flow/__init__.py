"""
Strategy Flow Backend Module

This module contains all backend logic for the Strategy Flow visual strategy builder:
- AI-powered flow generation
- Flow validation and auto-fix
- Backtrader integration for backtesting
- Live trading execution with broker APIs
"""

from .router import router
from .validator import validate_flow, ValidationResult
from .backtrader_engine import run_backtest, FlowStrategy
from .ai_generator import generate_flow_strategy

__all__ = [
    "router",
    "validate_flow",
    "ValidationResult",
    "run_backtest",
    "FlowStrategy",
    "generate_flow_strategy",
]

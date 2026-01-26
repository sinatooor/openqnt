"""
Risk Controls Module

Implements headless risk constraints for IR execution:
- Max drawdown limit
- Max position size limit
- Global Panic Button
"""
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path
import os
from ig_client import IGClient

@dataclass
class RiskConstraints:
    """Risk constraint configuration."""
    max_drawdown_pct: float = 10.0  # Maximum allowed drawdown percentage
    max_position_size: float = 100.0  # Maximum position size in units
    

@dataclass
class RiskViolation:
    """Record of a risk violation."""
    timestamp: Any
    rule: str
    message: str
    blocked_action: Optional[str] = None

# Panic Lock File
PANIC_LOCK_FILE = Path(".panic_lock")

class PanicService:
    """Service to handle global panic state."""
    
    LOCK_FILE = PANIC_LOCK_FILE
    
    @staticmethod
    def is_panic_active() -> bool:
        """Check if panic mode is active."""
        return PanicService.LOCK_FILE.exists()
    
    @staticmethod
    def clear_panic():
        """Clear panic state (manual intervention required usually)."""
        if PanicService.LOCK_FILE.exists():
            PanicService.LOCK_FILE.unlink()
            
    @staticmethod
    async def trigger_panic():
        """
        Enable panic mode:
        1. Set persistent flag
        2. Close all positions
        3. Cancel all orders
        """
        # 1. Set flag
        PanicService.LOCK_FILE.touch()
        
        # 2. Close/Cancel
        client = IGClient()
        
        login_res = await client.login()
        if not login_res["success"]:
            # If we can't login, we still set panic flag, but report error
            return {
                "success": False,
                "error": "Could not login to IG to close positions",
                "panic_enabled": True
            }
            
        close_res = await client.close_all_positions()
        cancel_res = await client.cancel_all_orders()
        
        return {
            "success": True,
            "panic_enabled": True,
            "positions_closed": close_res,
            "orders_cancelled": cancel_res
        }


class RiskController:
    """Applies risk constraints during IR execution."""
    
    def __init__(self, constraints: RiskConstraints, initial_equity: float = 10000.0):
        self.constraints = constraints
        self.initial_equity = initial_equity
        self.peak_equity = initial_equity
        self.current_equity = initial_equity
        self.violations: List[RiskViolation] = []
        self.is_trading_halted = False
        
    def update_equity(self, equity: float, timestamp: Any = None) -> bool:
        """
        Update current equity and check drawdown constraint.
        Returns True if trading is allowed, False if halted.
        """
        self.current_equity = equity
        
        # Update peak
        if equity > self.peak_equity:
            self.peak_equity = equity
            
        # Check drawdown
        drawdown_pct = self._calculate_drawdown()
        
        if drawdown_pct >= self.constraints.max_drawdown_pct:
            if not self.is_trading_halted:
                self.violations.append(RiskViolation(
                    timestamp=timestamp,
                    rule="MAX_DRAWDOWN",
                    message=f"Drawdown {drawdown_pct:.2f}% exceeds limit {self.constraints.max_drawdown_pct}%",
                    blocked_action="ALL_TRADES"
                ))
                self.is_trading_halted = True
            return False
            
        return True
        
    def validate_trade(self, size: float, timestamp: Any = None) -> Dict[str, Any]:
        """
        Validate a proposed trade against risk constraints.
        Returns dict with 'allowed' (bool), 'violations' (list), and optionally 'adjusted_size'.
        """
        violations = []
        allowed = True
        adjusted_size = size
        
        # Check if trading is halted
        if self.is_trading_halted:
            violations.append(RiskViolation(
                timestamp=timestamp,
                rule="TRADING_HALTED",
                message="Trading halted due to previous risk violation",
                blocked_action="TRADE"
            ))
            allowed = False
        
        # Check global panic
        if PanicService.is_panic_active():
            violations.append(RiskViolation(
                timestamp=timestamp,
                rule="PANIC_TRIGGERED",
                message="Global panic mode is active. All trading halted.",
                blocked_action="TRADE"
            ))
            allowed = False
            
        # Check position size
        if size > self.constraints.max_position_size:
            violations.append(RiskViolation(
                timestamp=timestamp,
                rule="MAX_POSITION_SIZE",
                message=f"Position size {size} exceeds limit {self.constraints.max_position_size}",
                blocked_action="TRADE"
            ))
            allowed = False
            # Record violation
            self.violations.extend(violations)
            
        if not allowed:
            self.violations.extend(violations)

        return {
            "allowed": allowed,
            "violations": violations,
            "adjusted_size": min(size, self.constraints.max_position_size) if allowed else 0
        }
        
    def _calculate_drawdown(self) -> float:
        """Calculate current drawdown percentage from peak."""
        if self.peak_equity <= 0:
            return 0.0
        return ((self.peak_equity - self.current_equity) / self.peak_equity) * 100
        
    def get_violations_log(self) -> List[str]:
        """Return human-readable list of all violations."""
        return [f"[{v.timestamp}] {v.rule}: {v.message}" for v in self.violations]
        
    def reset(self, initial_equity: float = None):
        """Reset the risk controller state."""
        if initial_equity is not None:
            self.initial_equity = initial_equity
        self.peak_equity = self.initial_equity
        self.current_equity = self.initial_equity
        self.violations = []
        self.is_trading_halted = False

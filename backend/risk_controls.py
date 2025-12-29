"""
Risk Controls Module

Implements headless risk constraints for IR execution:
- Max drawdown limit
- Max position size limit
"""
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field


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

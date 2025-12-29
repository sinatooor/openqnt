"""
IR Adaptation Module (Objective 008)

Implements logic that adapts IR strategies when a target broker lacks certain features.
For example: emulating OCO orders using individual stop/limit orders.
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType
from backend.broker_capabilities import BrokerCapabilities, OrderType


@dataclass
class AdaptationWarning:
    """Warning about a strategy adaptation."""
    original_feature: str
    adapted_to: str
    message: str
    impact: str  # "LOW", "MEDIUM", "HIGH"


@dataclass
class AdaptationResult:
    """Result of adapting a strategy to a broker."""
    success: bool
    adapted_strategy: Optional[StrategyIR]
    warnings: List[AdaptationWarning]
    errors: List[str]


class IRAdapter:
    """Adapts IR strategies to broker capabilities."""
    
    def __init__(self, broker: BrokerCapabilities):
        self.broker = broker
        
    def adapt(self, strategy: StrategyIR) -> AdaptationResult:
        """
        Adapt a strategy to work with the broker's capabilities.
        Returns AdaptationResult with success status and warnings.
        """
        warnings: List[AdaptationWarning] = []
        errors: List[str] = []
        
        # Clone the strategy for adaptation
        adapted = self._clone_strategy(strategy)
        
        # Check/adapt various features
        
        # 1. Check order type support
        order_warnings, order_errors = self._adapt_order_types(adapted)
        warnings.extend(order_warnings)
        errors.extend(order_errors)
        
        # 2. Check position sizing compatibility
        sizing_warnings, sizing_errors = self._adapt_position_sizing(adapted)
        warnings.extend(sizing_warnings)
        errors.extend(sizing_errors)
        
        if errors:
            return AdaptationResult(
                success=False,
                adapted_strategy=None,
                warnings=warnings,
                errors=errors
            )
            
        return AdaptationResult(
            success=True,
            adapted_strategy=adapted,
            warnings=warnings,
            errors=[]
        )
        
    def _clone_strategy(self, strategy: StrategyIR) -> StrategyIR:
        """Create a deep copy of the strategy."""
        # Simple clone - in production would be a proper deep copy
        return StrategyIR(
            name=strategy.name,
            rules=list(strategy.rules),
            position_sizing=strategy.position_sizing
        )
        
    def _adapt_order_types(self, strategy: StrategyIR) -> Tuple[List[AdaptationWarning], List[str]]:
        """Check and adapt order types based on broker support."""
        warnings = []
        errors = []
        
        # Check if strategy requires trailing stop
        requires_trailing_stop = self._strategy_requires_trailing_stop(strategy)
        
        if requires_trailing_stop:
            if OrderType.TRAILING_STOP not in self.broker.supported_order_types:
                # Can we emulate with regular stop?
                if OrderType.STOP in self.broker.supported_order_types:
                    warnings.append(AdaptationWarning(
                        original_feature="TRAILING_STOP",
                        adapted_to="STOP",
                        message=f"Broker {self.broker.name} does not support trailing stops. "
                               f"Emulating with regular stop orders (manual trailing required).",
                        impact="MEDIUM"
                    ))
                else:
                    errors.append(f"Broker {self.broker.name} does not support STOP or TRAILING_STOP orders")
                    
        # Check OCO support (common missing feature)
        requires_oco = self._strategy_requires_oco(strategy)
        if requires_oco:
            # Most brokers don't have native OCO, emulate with individual orders
            warnings.append(AdaptationWarning(
                original_feature="OCO",
                adapted_to="INDIVIDUAL_ORDERS",
                message="OCO orders emulated using individual stop and limit orders",
                impact="LOW"
            ))
            
        return warnings, errors
        
    def _adapt_position_sizing(self, strategy: StrategyIR) -> Tuple[List[AdaptationWarning], List[str]]:
        """Check and adapt position sizing to broker constraints."""
        warnings = []
        errors = []
        
        sizing = strategy.position_sizing
        
        # Check if fixed size is within broker limits
        if sizing.method == 'fixed' and sizing.value > 0:
            if sizing.value < self.broker.min_lot_size:
                errors.append(
                    f"Position size {sizing.value} below broker minimum {self.broker.min_lot_size}"
                )
            elif sizing.value > self.broker.max_lot_size:
                warnings.append(AdaptationWarning(
                    original_feature=f"SIZE_{sizing.value}",
                    adapted_to=f"SIZE_{self.broker.max_lot_size}",
                    message=f"Position size capped to broker maximum {self.broker.max_lot_size}",
                    impact="MEDIUM"
                ))
                sizing.value = self.broker.max_lot_size
                
        # Check lot step alignment
        if sizing.method == 'fixed' and sizing.value > 0:
            remainder = (sizing.value - self.broker.min_lot_size) % self.broker.lot_step
            if abs(remainder) > 1e-9 and abs(remainder - self.broker.lot_step) > 1e-9:
                # Adjust to nearest valid lot size
                adjusted = round(sizing.value / self.broker.lot_step) * self.broker.lot_step
                adjusted = max(adjusted, self.broker.min_lot_size)
                warnings.append(AdaptationWarning(
                    original_feature=f"SIZE_{sizing.value}",
                    adapted_to=f"SIZE_{adjusted}",
                    message=f"Position size adjusted to broker lot step: {sizing.value} -> {adjusted}",
                    impact="LOW"
                ))
                sizing.value = adjusted
                
        return warnings, errors
        
    def _strategy_requires_trailing_stop(self, strategy: StrategyIR) -> bool:
        """Check if strategy uses trailing stops."""
        # Simplified check - in production would parse rules more thoroughly
        for rule in strategy.rules:
            if hasattr(rule, 'order_type') and rule.order_type == 'TRAILING_STOP':
                return True
        return False
        
    def _strategy_requires_oco(self, strategy: StrategyIR) -> bool:
        """Check if strategy uses OCO (One-Cancels-Other) orders."""
        # Simplified check
        return False  # Most simple strategies don't need OCO


def adapt_strategy_to_broker(
    strategy: StrategyIR, 
    broker: BrokerCapabilities
) -> AdaptationResult:
    """
    Convenience function to adapt a strategy to a broker.
    
    Returns:
        AdaptationResult with adapted strategy or errors
    """
    adapter = IRAdapter(broker)
    return adapter.adapt(strategy)

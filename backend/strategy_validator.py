"""
Strategy Validation Service

Validates strategy definitions before execution.
Checks for common issues and provides suggestions.
"""
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum


class ValidationSeverity(Enum):
    ERROR = "error"       # Must fix before running
    WARNING = "warning"   # Should fix, may cause issues
    INFO = "info"         # Suggestion for improvement


@dataclass
class ValidationIssue:
    severity: ValidationSeverity
    code: str
    message: str
    suggestion: Optional[str] = None
    rule_index: Optional[int] = None


class StrategyValidator:
    """Validates strategy definitions and identifies issues."""
    
    def validate(self, strategy_ir: dict) -> List[ValidationIssue]:
        """
        Validate a strategy and return list of issues.
        
        Args:
            strategy_ir: Strategy IR as dict
            
        Returns:
            List of ValidationIssue objects
        """
        issues = []
        
        # Run all validation checks
        issues.extend(self._check_has_rules(strategy_ir))
        issues.extend(self._check_entry_exit_pairs(strategy_ir))
        issues.extend(self._check_position_sizing(strategy_ir))
        issues.extend(self._check_indicator_params(strategy_ir))
        issues.extend(self._check_redundant_conditions(strategy_ir))
        
        return issues
    
    def _check_has_rules(self, strategy: dict) -> List[ValidationIssue]:
        """Check that strategy has at least one rule."""
        rules = strategy.get("rules", [])
        if not rules:
            return [
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="NO_RULES",
                    message="Strategy has no rules defined",
                    suggestion="Add at least one entry rule to the strategy"
                )
            ]
        return []
    
    def _check_entry_exit_pairs(self, strategy: dict) -> List[ValidationIssue]:
        """Check for matching entry/exit rules."""
        rules = strategy.get("rules", [])
        issues = []
        
        actions = [r.get("action", {}) for r in rules]
        action_types = [a.get("type") if isinstance(a, dict) else str(a) for a in actions]
        
        has_long_entry = any("ENTER_LONG" in str(a) for a in action_types)
        has_long_exit = any("EXIT_LONG" in str(a) or "EXIT_ALL" in str(a) for a in action_types)
        has_short_entry = any("ENTER_SHORT" in str(a) for a in action_types)
        has_short_exit = any("EXIT_SHORT" in str(a) or "EXIT_ALL" in str(a) for a in action_types)
        
        if has_long_entry and not has_long_exit:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    code="NO_LONG_EXIT",
                    message="Strategy enters long but has no explicit exit rule",
                    suggestion="Add an exit rule or the position will be held indefinitely"
                )
            )
        
        if has_short_entry and not has_short_exit:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    code="NO_SHORT_EXIT",
                    message="Strategy enters short but has no explicit exit rule",
                    suggestion="Add an exit rule or the position will be held indefinitely"
                )
            )
        
        return issues
    
    def _check_position_sizing(self, strategy: dict) -> List[ValidationIssue]:
        """Check position sizing configuration."""
        sizing = strategy.get("position_sizing", {})
        value = sizing.get("value", 0)
        
        if value <= 0:
            return [
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="INVALID_SIZE",
                    message="Position size must be greater than 0",
                    suggestion="Set a valid position size"
                )
            ]
        
        method = sizing.get("method", "")
        if method == "percent_equity" and value > 100:
            return [
                ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    code="HIGH_RISK_SIZE",
                    message=f"Position size {value}% exceeds 100% of equity",
                    suggestion="Consider reducing position size for risk management"
                )
            ]
        
        return []
    
    def _check_indicator_params(self, strategy: dict) -> List[ValidationIssue]:
        """Check indicator parameters are valid."""
        issues = []
        
        for i, rule in enumerate(strategy.get("rules", [])):
            for condition in rule.get("conditions", []):
                left = condition.get("left", {})
                if left.get("type") in ["RSI", "SMA", "EMA", "MACD"]:
                    params = left.get("params", {})
                    period = params.get("period", 14)
                    if period < 2:
                        issues.append(
                            ValidationIssue(
                                severity=ValidationSeverity.ERROR,
                                code="INVALID_PERIOD",
                                message=f"Indicator period {period} is too small",
                                suggestion="Use a period of at least 2",
                                rule_index=i
                            )
                        )
        
        return issues
    
    def _check_redundant_conditions(self, strategy: dict) -> List[ValidationIssue]:
        """Check for redundant or conflicting conditions."""
        issues = []
        
        for i, rule in enumerate(strategy.get("rules", [])):
            conditions = rule.get("conditions", [])
            if len(conditions) > 5:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.INFO,
                        code="MANY_CONDITIONS",
                        message=f"Rule {i+1} has {len(conditions)} conditions",
                        suggestion="Consider simplifying for better signal generation",
                        rule_index=i
                    )
                )
        
        return issues
    
    def is_valid(self, strategy_ir: dict) -> bool:
        """Check if strategy has no errors (warnings are OK)."""
        issues = self.validate(strategy_ir)
        return not any(i.severity == ValidationSeverity.ERROR for i in issues)


# Export singleton
validator = StrategyValidator()

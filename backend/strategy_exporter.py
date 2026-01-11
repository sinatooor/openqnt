"""
Strategy Exporter Module

Converts StrategyIR to various output formats for portability.
Supports: Python (backtesting.py), JSON, Markdown, Pine Script (best-effort).
"""
import json
from dataclasses import asdict
from typing import Any

try:
    from strategy_ir import StrategyIR, Rule, Condition, MarketComponent, ActionType, ComparisonOperator
except ImportError:
    from backend.strategy_ir import StrategyIR, Rule, Condition, MarketComponent, ActionType, ComparisonOperator


class StrategyExporter:
    """Exports StrategyIR to multiple formats."""

    def export_python(self, ir: StrategyIR) -> str:
        """Generate executable backtesting.py strategy code."""
        lines = [
            "from backtesting import Backtest, Strategy",
            "from backtesting.lib import crossover",
            "import talib",
            "",
            f"class {self._safe_class_name(ir.name)}(Strategy):",
        ]

        # Generate indicator initialization
        indicators_used = self._collect_indicators(ir)
        if indicators_used:
            lines.append("    def init(self):")
            for ind in indicators_used:
                ind_code = self._indicator_to_python(ind)
                lines.append(f"        self.{ind['var_name']} = {ind_code}")
        else:
            lines.append("    def init(self):")
            lines.append("        pass")

        lines.append("")
        lines.append("    def next(self):")

        # Generate rules
        for rule in ir.rules:
            condition_str = self._conditions_to_python(rule.conditions)
            action_str = self._action_to_python(rule.action)
            lines.append(f"        if {condition_str}:")
            lines.append(f"            {action_str}")

        if not ir.rules:
            lines.append("        pass  # No rules defined")

        return "\n".join(lines)

    def export_json(self, ir: StrategyIR) -> str:
        """Export IR to JSON (round-trip compatible)."""
        def serialize(obj: Any) -> Any:
            if hasattr(obj, 'value'):  # Enums
                return obj.value
            if hasattr(obj, '__dataclass_fields__'):
                return {k: serialize(v) for k, v in asdict(obj).items()}
            if isinstance(obj, list):
                return [serialize(i) for i in obj]
            if isinstance(obj, dict):
                return {k: serialize(v) for k, v in obj.items()}
            return obj

        data = serialize(ir)
        return json.dumps(data, indent=2)

    def export_markdown(self, ir: StrategyIR) -> str:
        """Export IR to human-readable Markdown documentation."""
        lines = [
            f"# Strategy: {ir.name}",
            "",
            f"**Timeframe:** {ir.timeframe}",
            "",
            "## Position Sizing",
            f"- Method: `{ir.position_sizing.method}`",
            f"- Value: `{ir.position_sizing.value}`",
            "",
            "## Trading Rules",
            "",
        ]

        for i, rule in enumerate(ir.rules, 1):
            lines.append(f"### Rule {i}: {rule.action.value}")
            lines.append("")
            lines.append("**Conditions:**")
            for cond in rule.conditions:
                left_str = self._component_to_readable(cond.left)
                right_str = self._value_to_readable(cond.right)
                op_str = cond.operator.value
                lines.append(f"- {left_str} {op_str} {right_str}")
            lines.append("")

        if not ir.rules:
            lines.append("*No trading rules defined.*")

        return "\n".join(lines)

    def export_pinescript(self, ir: StrategyIR) -> str:
        """Export IR to Pine Script (TradingView) - best effort."""
        lines = [
            "//@version=5",
            f'strategy("{ir.name}", overlay=true)',
            "",
        ]

        # Declare indicators
        indicators = self._collect_indicators(ir)
        for ind in indicators:
            pine_code = self._indicator_to_pine(ind)
            lines.append(f"{ind['var_name']} = {pine_code}")

        lines.append("")

        # Generate rules
        for rule in ir.rules:
            cond_str = self._conditions_to_pine(rule.conditions)
            action_str = self._action_to_pine(rule.action)
            lines.append(f"if {cond_str}")
            lines.append(f"    {action_str}")

        return "\n".join(lines)

    # --- Helper Methods ---

    def _safe_class_name(self, name: str) -> str:
        return "".join(c if c.isalnum() else "_" for c in name).replace(" ", "_") or "GeneratedStrategy"

    def _collect_indicators(self, ir: StrategyIR) -> list:
        """Extract unique indicators from all conditions."""
        indicators = []
        seen = set()
        for rule in ir.rules:
            for cond in rule.conditions:
                for comp in [cond.left, cond.right]:
                    if isinstance(comp, MarketComponent) and comp.type.upper() not in ["CLOSE", "OPEN", "HIGH", "LOW", "VOLUME"]:
                        key = (comp.type, tuple(sorted(comp.params.items())))
                        if key not in seen:
                            seen.add(key)
                            var_name = f"{comp.type.lower()}_{len(indicators)}"
                            indicators.append({"type": comp.type, "params": comp.params, "var_name": var_name})
        return indicators

    def _indicator_to_python(self, ind: dict) -> str:
        """Convert indicator dict to Python talib call."""
        t = ind["type"].upper()
        params = ind["params"]
        if t == "RSI":
            period = params.get("period", 14)
            return f"self.I(talib.RSI, self.data.Close, timeperiod={period})"
        elif t in ["SMA", "EMA"]:
            period = params.get("period", 20)
            return f"self.I(talib.{t}, self.data.Close, timeperiod={period})"
        elif t == "MACD":
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            signal = params.get("signal", 9)
            return f"self.I(talib.MACD, self.data.Close, fastperiod={fast}, slowperiod={slow}, signalperiod={signal})[0]"
        else:
            return f"self.I(talib.{t}, self.data.Close)"

    def _conditions_to_python(self, conditions: list) -> str:
        parts = []
        for cond in conditions:
            left = self._component_to_python(cond.left)
            right = self._value_to_python(cond.right)
            op = cond.operator.value
            parts.append(f"({left} {op} {right})")
        return " and ".join(parts) if parts else "True"

    def _component_to_python(self, comp: MarketComponent) -> str:
        t = comp.type.upper()
        if t in ["CLOSE", "OPEN", "HIGH", "LOW", "VOLUME"]:
            return f"self.data.{t.capitalize()}[-1]"
        else:
            return f"self.{t.lower()}_0[-1]"

    def _value_to_python(self, val) -> str:
        if isinstance(val, MarketComponent):
            return self._component_to_python(val)
        return str(val)

    def _action_to_python(self, action: ActionType) -> str:
        mapping = {
            ActionType.ENTER_LONG: "self.buy()",
            ActionType.ENTER_SHORT: "self.sell()",
            ActionType.EXIT_LONG: "self.position.close()",
            ActionType.EXIT_SHORT: "self.position.close()",
            ActionType.EXIT_ALL: "self.position.close()",
        }
        return mapping.get(action, "pass")

    def _component_to_readable(self, comp: MarketComponent) -> str:
        if comp.params:
            params_str = ", ".join(f"{k}={v}" for k, v in comp.params.items())
            return f"{comp.type}({params_str})"
        return comp.type

    def _value_to_readable(self, val) -> str:
        if isinstance(val, MarketComponent):
            return self._component_to_readable(val)
        return str(val)

    def _indicator_to_pine(self, ind: dict) -> str:
        t = ind["type"].upper()
        params = ind["params"]
        if t == "RSI":
            period = params.get("period", 14)
            return f"ta.rsi(close, {period})"
        elif t == "SMA":
            period = params.get("period", 20)
            return f"ta.sma(close, {period})"
        elif t == "EMA":
            period = params.get("period", 20)
            return f"ta.ema(close, {period})"
        else:
            return f"ta.{t.lower()}(close)"

    def _conditions_to_pine(self, conditions: list) -> str:
        parts = []
        for cond in conditions:
            left = self._component_to_pine(cond.left)
            right = self._value_to_pine(cond.right)
            op = cond.operator.value
            parts.append(f"({left} {op} {right})")
        return " and ".join(parts) if parts else "true"

    def _component_to_pine(self, comp: MarketComponent) -> str:
        t = comp.type.upper()
        if t in ["CLOSE", "OPEN", "HIGH", "LOW", "VOLUME"]:
            return t.lower()
        else:
            return f"{t.lower()}_0"

    def _value_to_pine(self, val) -> str:
        if isinstance(val, MarketComponent):
            return self._component_to_pine(val)
        return str(val)

    def _action_to_pine(self, action: ActionType) -> str:
        mapping = {
            ActionType.ENTER_LONG: "strategy.entry(\"Long\", strategy.long)",
            ActionType.ENTER_SHORT: "strategy.entry(\"Short\", strategy.short)",
            ActionType.EXIT_LONG: "strategy.close(\"Long\")",
            ActionType.EXIT_SHORT: "strategy.close(\"Short\")",
            ActionType.EXIT_ALL: "strategy.close_all()",
        }
        return mapping.get(action, "// unknown action")

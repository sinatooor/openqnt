"""
IR Execution Simulator

Pure simulation engine that executes IR strategies against historical price data
without broker logic.
"""
import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.strategy_ir import StrategyIR, Rule, Condition, ActionType, MarketComponent, ComparisonOperator, PositionSizing
from backend.risk_controls import RiskController, RiskViolation

@dataclass
class Trade:
    entry_time: datetime
    entry_price: float
    direction: str  # 'LONG' or 'SHORT'
    size: float
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    pnl: float = 0.0
    exit_reason: str = ""
    status: str = "OPEN"

@dataclass
class SimulationResult:
    trades: List[Trade]
    initial_equity: float
    final_equity: float
    equity_curve: pd.DataFrame
    metrics: Dict[str, Any]
    processed_data: pd.DataFrame
    risk_violations: List[RiskViolation] = field(default_factory=list)

class IRSimulator:
    def __init__(self, initial_equity: float = 10000.0, risk_controller: Optional[RiskController] = None):
        self.initial_equity = initial_equity
        self.equity = initial_equity
        self.trades: List[Trade] = []
        self.position: Optional[Trade] = None
        self.history: List[Dict[str, Any]] = []
        self.risk_controller = risk_controller

    def run(self, strategy: StrategyIR, data: pd.DataFrame) -> SimulationResult:
        self._reset()
        
        # 1. Prepare Data (Calculate Indicators)
        df = self._prepare_data(data.copy(), strategy)
        
        # 2. Iterate Bars
        for idx, row in df.iterrows():
            self._process_bar(row, strategy)
            self._update_equity(row['close'], row.name)
            
        # 3. Close open position at end
        if self.position:
            last_row = df.iloc[-1]
            self._close_position(last_row['close'], last_row.name, "END_OF_DATA")
            
        return self._generate_result(df)

    def _reset(self):
        self.equity = self.initial_equity
        self.trades = []
        self.position = None
        self.history = []
        if self.risk_controller:
            self.risk_controller.reset(initial_equity=self.initial_equity)

    def _prepare_data(self, data: pd.DataFrame, strategy: StrategyIR) -> pd.DataFrame:
        # Normalize columns to lowercase for easier access
        data.columns = [c.lower() for c in data.columns]
        
        # Extract all MarketComponents from rules
        components = []
        for rule in strategy.rules:
            for cond in rule.conditions:
                if isinstance(cond.left, MarketComponent):
                    components.append(cond.left)
                if isinstance(cond.right, MarketComponent):
                    components.append(cond.right)
                    
        # Calculate indicators
        for comp in components:
            self._calculate_indicator(data, comp)
            
        return data

    def _calculate_indicator(self, data: pd.DataFrame, comp: MarketComponent):
        col_name = self._get_component_name(comp)
        if col_name in data.columns:
            return

        p = comp.params
        if comp.type == 'SMA':
            period = int(p.get('period', 14))
            src = p.get('source', 'close').lower()
            data[col_name] = data[src].rolling(window=period).mean()
            
        elif comp.type == 'RSI':
            period = int(p.get('period', 14))
            src = p.get('source', 'close').lower()
            delta = data[src].diff()
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            
            # Use Wilder's smoothing
            avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
            
            rs = avg_gain / avg_loss
            data[col_name] = 100 - (100 / (1 + rs))
            
        elif comp.type in ['Close', 'Open', 'High', 'Low', 'Volume']:
            # These should already be in data (normalized to lowercase)
            pass

    def _get_component_name(self, comp: MarketComponent) -> str:
        if comp.type in ['Close', 'Open', 'High', 'Low', 'Volume']:
            return comp.type.lower()
        # Create unique name based on params
        param_str = "_".join([f"{k}{v}" for k,v in sorted(comp.params.items())])
        return f"{comp.type}_{param_str}".lower()

    def _process_bar(self, row: pd.Series, strategy: StrategyIR):
        # Check Rules
        for rule in strategy.rules:
            if self._evaluate_rule(rule, row):
                self._execute_action(rule.action, row, strategy)

    def _evaluate_rule(self, rule: Rule, row: pd.Series) -> bool:
        if not rule.conditions:
            return False 
            
        for cond in rule.conditions:
            val_left = self._resolve_value(cond.left, row)
            val_right = self._resolve_value(cond.right, row)
            
            if not self._compare(val_left, cond.operator, val_right):
                return False
        return True

    def _resolve_value(self, item: Any, row: pd.Series) -> float:
        if isinstance(item, MarketComponent):
            col_name = self._get_component_name(item)
            val = row.get(col_name)
            if val is None or pd.isna(val):
                return 0.0 # Or raise error / handle nan
            return float(val)
        return float(item)

    def _compare(self, left: float, op: ComparisonOperator, right: float) -> bool:
        op_val = op.value if isinstance(op, ComparisonOperator) else op
        
        if op_val == ">": return left > right
        if op_val == "<": return left < right
        if op_val == ">=": return left >= right
        if op_val == "<=": return left <= right
        if op_val == "==": return left == right
        if op_val == "!=": return left != right
        return False

    def _execute_action(self, action: ActionType, row: pd.Series, strategy: StrategyIR):
        price = row['close']
        time = row.name
        
        # Determine Size
        size = strategy.position_sizing.value 
        if strategy.position_sizing.method == 'percent_equity':
             size = (self.equity * size) / price
        
        # Validate entry against Risk Controller
        if action in [ActionType.ENTER_LONG, ActionType.ENTER_SHORT] and self.risk_controller:
            validation = self.risk_controller.validate_trade(size, timestamp=time)
            if not validation['allowed']:
                # Trade blocked by risk controller
                return
            # Use adjusted size (e.g. capped at max_position_size)
            size = validation.get('adjusted_size', size)
        
        if action == ActionType.ENTER_LONG:
            if self.position and self.position.direction == 'SHORT':
                self._close_position(price, time, "REVERSE")
            if not self.position:
                self._open_position(price, time, 'LONG', size)
                
        elif action == ActionType.ENTER_SHORT:
            if self.position and self.position.direction == 'LONG':
                self._close_position(price, time, "REVERSE")
            if not self.position:
                self._open_position(price, time, 'SHORT', size)
                
        elif action == ActionType.EXIT_LONG:
            if self.position and self.position.direction == 'LONG':
                self._close_position(price, time, "EXIT_SIGNAL")
                
        elif action == ActionType.EXIT_SHORT:
            if self.position and self.position.direction == 'SHORT':
                self._close_position(price, time, "EXIT_SIGNAL")
                
        elif action == ActionType.EXIT_ALL:
             if self.position:
                self._close_position(price, time, "EXIT_ALL")

    def _open_position(self, price: float, time: datetime, direction: str, size: float):
        self.position = Trade(
            entry_time=time,
            entry_price=price,
            direction=direction,
            size=size,
            status="OPEN"
        )

    def _close_position(self, price: float, time: datetime, reason: str):
        trade = self.position
        trade.exit_time = time
        trade.exit_price = price
        trade.exit_reason = reason
        trade.status = 'CLOSED'
        
        multiplier = 1 if trade.direction == 'LONG' else -1
        trade.pnl = (trade.exit_price - trade.entry_price) * trade.size * multiplier
        
        self.equity += trade.pnl
        self.trades.append(trade)
        self.position = None

    def _update_equity(self, price: float, time: datetime):
        current_equity = self.equity
        if self.position:
            multiplier = 1 if self.position.direction == 'LONG' else -1
            unrealized_pnl = (price - self.position.entry_price) * self.position.size * multiplier
            current_equity += unrealized_pnl
        
        # Update risk controller with current equity
        if self.risk_controller:
            self.risk_controller.update_equity(current_equity, timestamp=time)
            
        self.history.append({
            'timestamp': time,
            'equity': current_equity
        })

    def _generate_result(self, df: pd.DataFrame) -> SimulationResult:
        equity_df = pd.DataFrame(self.history)
        if not equity_df.empty:
            equity_df.set_index('timestamp', inplace=True)
            
        metrics = {
            'total_trades': len(self.trades),
            'winning_trades': len([t for t in self.trades if t.pnl > 0]),
            'losing_trades': len([t for t in self.trades if t.pnl <= 0]),
            'final_equity': self.equity,
            'return_pct': (self.equity - self.initial_equity) / self.initial_equity * 100 if self.initial_equity else 0
        }
        
        return SimulationResult(
            trades=self.trades,
            initial_equity=self.initial_equity,
            final_equity=self.equity,
            equity_curve=equity_df,
            metrics=metrics,
            processed_data=df,
            risk_violations=self.risk_controller.violations if self.risk_controller else []
        )

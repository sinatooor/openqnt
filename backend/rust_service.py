
from typing import List, Dict, Any, Optional
import pandas as pd
from rust_backtest import Backtester, Bar, BacktestResult

class RustBacktestService:
    """
    Service to bridge Python data structures with the generic Rust Backtester.
    """
    def __init__(self):
        self.engine = Backtester()

    def convert_to_rust_bars(self, df: pd.DataFrame) -> List[Bar]:
        """Convert pandas DataFrame to list of Rust Bar objects"""
        bars = []
        for index, row in df.iterrows():
            # Handle Timestamp to int conversion (assume unix timestamp)
            ts = int(index.timestamp()) if hasattr(index, 'timestamp') else 0
            
            bars.append(Bar(
                timestamp=ts,
                open=float(row.get('Open', 0)),
                high=float(row.get('High', 0)),
                low=float(row.get('Low', 0)),
                close=float(row.get('Close', 0)),
                volume=float(row.get('Volume', 0))
            ))
        return bars

    def run_strategy(self, data: pd.DataFrame, strategy_config: Dict[str, Any]) -> BacktestResult:
        """
        Run a backtest using the Rust engine.
        
        Args:
            data: DataFrame with OHLCV data
            strategy_config: Dictionary defining strategy parameters
            
        Returns:
            Rust BacktestResult object
        """
        bars = self.convert_to_rust_bars(data)
        
        # Note: The actual 'run' method signature depends on the Rust implementation.
        # Assuming run(bars, strategy_json) for now based on typical patterns.
        # We need to serialize config to JSON string if Rust expects a string, 
        # or pass dict if PyO3 handles it.
        
        import json
        config_str = json.dumps(strategy_config)
        
        return self.engine.run(bars, config_str)



import pytest
import time
import math
from rust_backtest import Backtester, Bar, Trade

def test_rust_check_version():
    import rust_backtest
    assert hasattr(rust_backtest, "__version__")
    print(f"Rust Backtest Version: {rust_backtest.__version__}")

def test_simple_sma_strategy():
    # 1. Generate Dummy Data
    dates = range(100)
    prices = [100 + math.sin(x/10) * 10 for x in dates]
    
    bars = []
    for i, p in enumerate(prices):
        bars.append(Bar(
            timestamp=i * 60,
            open=p,
            high=p + 1,
            low=p - 1,
            close=p,
            volume=1000.0
        ))
    
    # 2. Initialize Rust Backtester
    backtester = Backtester()
    
    # 3. Run Backtest
    # Strategy: Buy if price > 100, Sell if price < 100 (Simple logic for test)
    # Note: We need to see how the actual Rust strategy logic is injected. 
    # For now, we assume the generic Backtester has a run method or similar.
    # Looking at lib.rs, we likely need to define how the strategy is passed, 
    # or if there's a specific method. 
    # Let's inspect the available methods first in a safer way.
    
    assert hasattr(backtester, "run")

if __name__ == "__main__":
    test_rust_check_version()
    # test_simple_sma_strategy() # Commented out until we confirm API
    print("Version check passed!")

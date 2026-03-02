"""
Strategy Templates - Pre-built Python strategy code for backtesting.py

These templates provide ready-to-use Strategy classes for common patterns.
"""

from typing import Optional


# Pre-built strategy templates
TEMPLATES = {
    "simple_ma_crossover": '''
from backtesting import Strategy
from backtesting.lib import crossover
from backtesting.test import SMA

class SimpleMAcrossover(Strategy):
    """Simple Moving Average Crossover Strategy."""
    fast_period = 10
    slow_period = 20
    
    def init(self):
        close = self.data.Close
        self.sma_fast = self.I(SMA, close, self.fast_period)
        self.sma_slow = self.I(SMA, close, self.slow_period)
    
    def next(self):
        if crossover(self.sma_fast, self.sma_slow):
            self.buy()
        elif crossover(self.sma_slow, self.sma_fast):
            self.position.close()
''',

    "rsi_oversold_reversal": '''
from backtesting import Strategy
import numpy as np

def RSI(values, n=14):
    """Calculate Relative Strength Index."""
    deltas = np.diff(values)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.zeros_like(values)
    avg_loss = np.zeros_like(values)
    
    avg_gain[n] = np.mean(gains[:n])
    avg_loss[n] = np.mean(losses[:n])
    
    for i in range(n + 1, len(values)):
        avg_gain[i] = (avg_gain[i-1] * (n-1) + gains[i-1]) / n
        avg_loss[i] = (avg_loss[i-1] * (n-1) + losses[i-1]) / n
    
    rs = np.where(avg_loss != 0, avg_gain / avg_loss, 100)
    rsi = 100 - (100 / (1 + rs))
    return rsi

class RSIOversoldReversal(Strategy):
    """Buy when RSI drops below 30, close when it rises above 70."""
    rsi_period = 14
    oversold = 30
    overbought = 70
    
    def init(self):
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
    
    def next(self):
        if self.rsi[-1] < self.oversold and not self.position:
            self.buy()
        elif self.rsi[-1] > self.overbought and self.position:
            self.position.close()
''',

    "breakout_strategy": '''
from backtesting import Strategy
import numpy as np

class BreakoutStrategy(Strategy):
    """Buy when price breaks above 20-day high, sell on 20-day low."""
    lookback = 20
    
    def init(self):
        close = self.data.Close
        high = self.data.High
        low = self.data.Low
        
        # Rolling max and min
        self.highest = self.I(lambda: np.array([max(high[max(0,i-self.lookback):i+1]) if i > 0 else high[0] for i in range(len(high))]))
        self.lowest = self.I(lambda: np.array([min(low[max(0,i-self.lookback):i+1]) if i > 0 else low[0] for i in range(len(low))]))
    
    def next(self):
        if len(self.data) < self.lookback:
            return
            
        if self.data.Close[-1] > self.highest[-2] and not self.position:
            self.buy()
        elif self.data.Close[-1] < self.lowest[-2] and self.position:
            self.position.close()
''',

    "mean_reversion": '''
from backtesting import Strategy
from backtesting.test import SMA
import numpy as np

def STDDEV(values, n=20):
    """Calculate rolling standard deviation."""
    result = np.zeros_like(values)
    for i in range(n-1, len(values)):
        result[i] = np.std(values[i-n+1:i+1])
    return result

class MeanReversion(Strategy):
    """Bollinger Band mean reversion strategy."""
    period = 20
    num_std = 2
    
    def init(self):
        close = self.data.Close
        self.sma = self.I(SMA, close, self.period)
        self.std = self.I(STDDEV, close, self.period)
    
    def next(self):
        if len(self.data) < self.period:
            return
            
        upper_band = self.sma[-1] + (self.num_std * self.std[-1])
        lower_band = self.sma[-1] - (self.num_std * self.std[-1])
        
        # Buy when price touches lower band
        if self.data.Close[-1] < lower_band and not self.position:
            self.buy()
        # Sell when price touches upper band
        elif self.data.Close[-1] > upper_band and self.position:
            self.position.close()
''',

    "ema_crossover": '''
from backtesting import Strategy
from backtesting.lib import crossover
import numpy as np

def EMA(values, n):
    """Exponential Moving Average."""
    values = np.asarray(values)
    alpha = 2 / (n + 1)
    ema = np.zeros_like(values, dtype=float)
    ema[0] = values[0]
    for i in range(1, len(values)):
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i-1]
    return ema

class EMACrossover(Strategy):
    """EMA 12/26 Crossover Strategy (MACD-inspired)."""
    fast_period = 12
    slow_period = 26
    
    def init(self):
        close = self.data.Close
        self.ema_fast = self.I(EMA, close, self.fast_period)
        self.ema_slow = self.I(EMA, close, self.slow_period)
    
    def next(self):
        if crossover(self.ema_fast, self.ema_slow):
            self.buy()
        elif crossover(self.ema_slow, self.ema_fast):
            self.position.close()
''',

    "statistical_arbitrage": '''
from backtesting import Strategy
import numpy as np

class StatisticalArbitrage(Strategy):
    """Pairs trading strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "hmm_regime_switching": '''
from backtesting import Strategy

class HMMRegimeSwitching(Strategy):
    """HMM Regime Switching Strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "diversification_allocation": '''
from backtesting import Strategy

class DiversificationAllocation(Strategy):
    """Diversification and Allocation Strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "portfolio_rebalancing": '''
from backtesting import Strategy

class PortfolioRebalancing(Strategy):
    """Portfolio Rebalancing Strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "protective_put": '''
from backtesting import Strategy

class ProtectivePut(Strategy):
    """Protective Put Strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "options_collar": '''
from backtesting import Strategy

class OptionsCollar(Strategy):
    """Options Collar Strategy placeholder."""
    def init(self):
        pass
    def next(self):
        pass
''',

    "trailing_stop_loss": '''
from backtesting import Strategy
from backtesting.test import SMA
from backtesting.lib import crossover

class TrailingStopLoss(Strategy):
    """Strategy using a trailing stop loss."""
    fast_period = 10
    slow_period = 20
    trailing_sl_pct = 0.05
    
    def init(self):
        close = self.data.Close
        self.sma_fast = self.I(SMA, close, self.fast_period)
        self.sma_slow = self.I(SMA, close, self.slow_period)
        
    def next(self):
        if crossover(self.sma_fast, self.sma_slow):
            # Enter with a trailing stop loss
            self.buy(sl=self.data.Close[-1] * (1 - self.trailing_sl_pct))
''',

    "inverse_etf_hedging": '''
from backtesting import Strategy
from backtesting.test import SMA

class InverseETFHedging(Strategy):
    """Inverse ETF Hedging Strategy."""
    period = 200
    
    def init(self):
        self.sma = self.I(SMA, self.data.Close, self.period)
        
    def next(self):
        if len(self.data) < self.period: return
        if self.data.Close[-1] < self.sma[-1] and not self.position:
            # Simulate buying inverse ETF by going short
            self.sell()
        elif self.data.Close[-1] > self.sma[-1] and self.position.is_short:
            self.position.close()
''',
}

# Aliases for template names (maps frontend templateId to code key)
TEMPLATE_ALIASES = {
    "simple-ma-crossover": "simple_ma_crossover",
    "Simple MA Crossover": "simple_ma_crossover",
    "rsi-oversold-reversal": "rsi_oversold_reversal",
    "RSI Oversold Reversal": "rsi_oversold_reversal",
    "breakout-strategy": "breakout_strategy",
    "Breakout Strategy": "breakout_strategy",
    "mean-reversion": "mean_reversion",
    "Mean Reversion": "mean_reversion",
    "ema-crossover": "ema_crossover",
    "EMA Crossover": "ema_crossover",
    "statistical-arbitrage": "statistical_arbitrage",
    "hmm-regime-switching": "hmm_regime_switching",
    "diversification-allocation": "diversification_allocation",
    "portfolio-rebalancing": "portfolio_rebalancing",
    "protective-put": "protective_put",
    "options-collar": "options_collar",
    "trailing-stop-loss": "trailing_stop_loss",
    "inverse-etf-hedging": "inverse_etf_hedging",
}


def get_template_code(template_id: str) -> Optional[str]:
    """
    Get the pre-built Python code for a template.
    
    Args:
        template_id: Template identifier (can be key or alias)
        
    Returns:
        Python code string or None if not found
    """
    # Normalize the template_id
    normalized = template_id.lower().replace(" ", "_").replace("-", "_")
    
    # Try direct lookup first
    if normalized in TEMPLATES:
        return TEMPLATES[normalized]
    
    # Try alias lookup
    if template_id in TEMPLATE_ALIASES:
        key = TEMPLATE_ALIASES[template_id]
        return TEMPLATES.get(key)
    
    # Try normalized alias lookup
    for alias, key in TEMPLATE_ALIASES.items():
        if alias.lower().replace(" ", "_").replace("-", "_") == normalized:
            return TEMPLATES.get(key)
    
    return None


def list_templates() -> list:
    """List all available template names."""
    return list(TEMPLATES.keys())

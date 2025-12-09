"""
Pre-built Python Strategy Templates using TA-Lib

These strategies match the frontend templates exactly.
When a user selects a template without modifications, we use this
pre-compiled code directly instead of parsing XML.

All indicators use TA-Lib for maximum performance and reliability.
Note: talib is imported inside the code strings, not at module level.
"""

from typing import Optional, Dict, Tuple


# =============================================================================
# TEMPLATE 1: RSI Oversold Reversal
# =============================================================================
RSI_OVERSOLD_REVERSAL_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

class GeneratedStrategy(Strategy):
    """
    RSI Oversold Reversal Strategy
    - Buy when RSI < 30 (oversold)
    - Exit when RSI > 70 (overbought)
    - SL: Entry - 1.5 * ATR
    - TP: Entry + 3 * ATR
    """
    rsi_period = 14
    rsi_oversold = 30
    rsi_overbought = 70
    atr_period = 14
    atr_sl_mult = 1.5
    atr_tp_mult = 3.0
    
    def init(self):
        self.rsi = self.I(talib.RSI, self.data.Close, timeperiod=self.rsi_period)
        self.atr = self.I(talib.ATR, self.data.High, self.data.Low, self.data.Close, timeperiod=self.atr_period)
    
    def next(self):
        price = self.data.Close[-1]
        atr = self.atr[-1]
        
        if np.isnan(atr) or atr <= 0:
            return
            
        # Long entry when RSI < oversold
        if self.rsi[-1] < self.rsi_oversold and not self.position:
            sl = price - (atr * self.atr_sl_mult)
            tp = price + (atr * self.atr_tp_mult)
            self.buy(sl=sl, tp=tp)
        
        # Exit when RSI > overbought
        elif self.rsi[-1] > self.rsi_overbought and self.position:
            self.position.close()
'''


# =============================================================================
# TEMPLATE 2: Simple MA Crossover
# =============================================================================
SIMPLE_MA_CROSSOVER_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

class GeneratedStrategy(Strategy):
    """
    Simple MA Crossover Strategy
    - Buy when price crosses above SMA
    - Sell when price crosses below SMA
    - Uses close price for crossover detection
    """
    ma_period = 12
    
    def init(self):
        self.sma = self.I(talib.SMA, self.data.Close, timeperiod=self.ma_period)
    
    def next(self):
        # Detect crossover: previous close < SMA, current close > SMA
        if len(self.data.Close) < 2:
            return
            
        prev_close = self.data.Close[-2]
        curr_close = self.data.Close[-1]
        prev_sma = self.sma[-2] if len(self.sma) > 1 else self.sma[-1]
        curr_sma = self.sma[-1]
        
        if np.isnan(curr_sma):
            return
        
        # Bullish crossover: was below, now above
        if prev_close < prev_sma and curr_close > curr_sma:
            if self.position.is_short:
                self.position.close()
            if not self.position:
                self.buy()
        
        # Bearish crossover: was above, now below
        elif prev_close > prev_sma and curr_close < curr_sma:
            if self.position.is_long:
                self.position.close()
            if not self.position:
                self.sell()
'''


# =============================================================================
# TEMPLATE 3: Bollinger Band Breakout
# =============================================================================
BOLLINGER_BREAKOUT_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

class GeneratedStrategy(Strategy):
    """
    Bollinger Band Breakout Strategy
    - Buy when price breaks above upper band
    - SL: Entry - 2.5 * ATR
    - TP: Entry + 7.5 * ATR (3:1 ratio)
    """
    bb_period = 20
    bb_std = 2.0
    atr_period = 14
    atr_sl_mult = 2.5
    atr_tp_mult = 7.5
    
    def init(self):
        self.bb_upper, self.bb_middle, self.bb_lower = self.I(
            talib.BBANDS, self.data.Close, 
            timeperiod=self.bb_period, 
            nbdevup=self.bb_std, 
            nbdevdn=self.bb_std
        )
        self.atr = self.I(talib.ATR, self.data.High, self.data.Low, self.data.Close, timeperiod=self.atr_period)
    
    def next(self):
        price = self.data.Close[-1]
        atr = self.atr[-1]
        upper = self.bb_upper[-1]
        
        if np.isnan(atr) or atr <= 0 or np.isnan(upper):
            return
            
        # Long entry on upper band breakout
        if price > upper and not self.position:
            sl = price - (atr * self.atr_sl_mult)
            tp = price + (atr * self.atr_tp_mult)
            self.buy(sl=sl, tp=tp)
'''


# =============================================================================
# TEMPLATE 4: MACD Momentum
# =============================================================================
MACD_MOMENTUM_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

class GeneratedStrategy(Strategy):
    """
    MACD Momentum Strategy
    - Buy when MACD line > Signal line AND ADX > 25 (trend confirmation)
    - SL: Entry - 2 * ATR
    - TP: Entry + 6 * ATR (3:1 ratio)
    """
    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
    adx_period = 14
    adx_threshold = 25
    atr_period = 14
    atr_sl_mult = 2.0
    atr_tp_mult = 6.0
    
    def init(self):
        self.macd, self.macd_signal_line, self.macd_hist = self.I(
            talib.MACD, self.data.Close,
            fastperiod=self.macd_fast,
            slowperiod=self.macd_slow,
            signalperiod=self.macd_signal
        )
        self.adx = self.I(talib.ADX, self.data.High, self.data.Low, self.data.Close, timeperiod=self.adx_period)
        self.atr = self.I(talib.ATR, self.data.High, self.data.Low, self.data.Close, timeperiod=self.atr_period)
    
    def next(self):
        price = self.data.Close[-1]
        atr = self.atr[-1]
        macd_val = self.macd[-1]
        signal_val = self.macd_signal_line[-1]
        adx_val = self.adx[-1]
        
        if np.isnan(atr) or atr <= 0 or np.isnan(macd_val) or np.isnan(adx_val):
            return
            
        # Long entry: MACD > Signal AND ADX > threshold (trend confirmation)
        if macd_val > signal_val and adx_val > self.adx_threshold and not self.position:
            sl = price - (atr * self.atr_sl_mult)
            tp = price + (atr * self.atr_tp_mult)
            self.buy(sl=sl, tp=tp)
'''


# =============================================================================
# TEMPLATE 5: VWAP Scalping
# =============================================================================
VWAP_SCALPING_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

def calculate_vwap(high, low, close, volume):
    """Calculate VWAP (Volume Weighted Average Price)"""
    typical_price = (high + low + close) / 3
    vwap = np.cumsum(typical_price * volume) / np.cumsum(volume)
    return vwap

class GeneratedStrategy(Strategy):
    """
    VWAP Scalping Strategy
    - Buy when price < VWAP AND RSI < 40 (mean reversion)
    - SL: Entry - 1 * ATR (tight for scalping)
    - TP: Entry + 2 * ATR (2:1 ratio)
    """
    rsi_period = 9
    rsi_threshold = 40
    atr_period = 14
    atr_sl_mult = 1.0
    atr_tp_mult = 2.0
    
    def init(self):
        self.rsi = self.I(talib.RSI, self.data.Close, timeperiod=self.rsi_period)
        self.atr = self.I(talib.ATR, self.data.High, self.data.Low, self.data.Close, timeperiod=self.atr_period)
        # Calculate VWAP - note: backtesting.py may not always have Volume
        try:
            self.vwap = self.I(calculate_vwap, self.data.High, self.data.Low, self.data.Close, self.data.Volume)
        except:
            # Fallback: use SMA as proxy if no volume data
            self.vwap = self.I(talib.SMA, self.data.Close, timeperiod=20)
    
    def next(self):
        price = self.data.Close[-1]
        atr = self.atr[-1]
        rsi = self.rsi[-1]
        vwap = self.vwap[-1]
        
        if np.isnan(atr) or atr <= 0 or np.isnan(rsi) or np.isnan(vwap):
            return
            
        # Long entry: Price < VWAP AND RSI < threshold
        if price < vwap and rsi < self.rsi_threshold and not self.position:
            sl = price - (atr * self.atr_sl_mult)
            tp = price + (atr * self.atr_tp_mult)
            self.buy(sl=sl, tp=tp)
'''


# =============================================================================
# TEMPLATE 6: Triple EMA Trend
# =============================================================================
TRIPLE_EMA_TREND_CODE = '''
import talib
import numpy as np
from backtesting import Strategy

class GeneratedStrategy(Strategy):
    """
    Triple EMA Trend Strategy (Fibonacci periods: 8, 21, 55)
    - Buy when Fast EMA > Medium EMA > Slow EMA (aligned uptrend)
    - SL: Entry - 2 * ATR
    - TP: Entry + 6 * ATR (3:1 ratio)
    """
    ema_fast = 8
    ema_medium = 21
    ema_slow = 55
    atr_period = 14
    atr_sl_mult = 2.0
    atr_tp_mult = 6.0
    
    def init(self):
        self.ema_fast_line = self.I(talib.EMA, self.data.Close, timeperiod=self.ema_fast)
        self.ema_medium_line = self.I(talib.EMA, self.data.Close, timeperiod=self.ema_medium)
        self.ema_slow_line = self.I(talib.EMA, self.data.Close, timeperiod=self.ema_slow)
        self.atr = self.I(talib.ATR, self.data.High, self.data.Low, self.data.Close, timeperiod=self.atr_period)
    
    def next(self):
        price = self.data.Close[-1]
        atr = self.atr[-1]
        fast = self.ema_fast_line[-1]
        medium = self.ema_medium_line[-1]
        slow = self.ema_slow_line[-1]
        
        if np.isnan(atr) or atr <= 0 or np.isnan(fast) or np.isnan(medium) or np.isnan(slow):
            return
            
        # Aligned uptrend: Fast > Medium > Slow
        if fast > medium > slow and not self.position:
            sl = price - (atr * self.atr_sl_mult)
            tp = price + (atr * self.atr_tp_mult)
            self.buy(sl=sl, tp=tp)
        
        # Exit when trend alignment breaks
        elif self.position and not (fast > medium > slow):
            self.position.close()
'''


# =============================================================================
# TEMPLATE REGISTRY
# =============================================================================
TEMPLATE_STRATEGIES = {
    "rsi-oversold-reversal": {
        "code": RSI_OVERSOLD_REVERSAL_CODE,
        "name": "RSI Oversold Reversal",
        "params": {
            "rsi_period": 14,
            "rsi_oversold": 30,
            "rsi_overbought": 70,
            "atr_period": 14,
            "atr_sl_mult": 1.5,
            "atr_tp_mult": 3.0
        }
    },
    "simple-ma-crossover": {
        "code": SIMPLE_MA_CROSSOVER_CODE,
        "name": "Simple MA Crossover",
        "params": {
            "ma_period": 12
        }
    },
    "bollinger-breakout": {
        "code": BOLLINGER_BREAKOUT_CODE,
        "name": "Bollinger Band Breakout",
        "params": {
            "bb_period": 20,
            "bb_std": 2.0,
            "atr_period": 14,
            "atr_sl_mult": 2.5,
            "atr_tp_mult": 7.5
        }
    },
    "macd-momentum": {
        "code": MACD_MOMENTUM_CODE,
        "name": "MACD Momentum",
        "params": {
            "macd_fast": 12,
            "macd_slow": 26,
            "macd_signal": 9,
            "adx_period": 14,
            "adx_threshold": 25,
            "atr_period": 14,
            "atr_sl_mult": 2.0,
            "atr_tp_mult": 6.0
        }
    },
    "scalping-vwap": {
        "code": VWAP_SCALPING_CODE,
        "name": "VWAP Scalping",
        "params": {
            "rsi_period": 9,
            "rsi_threshold": 40,
            "atr_period": 14,
            "atr_sl_mult": 1.0,
            "atr_tp_mult": 2.0
        }
    },
    "triple-ema-trend": {
        "code": TRIPLE_EMA_TREND_CODE,
        "name": "Triple EMA Trend",
        "params": {
            "ema_fast": 8,
            "ema_medium": 21,
            "ema_slow": 55,
            "atr_period": 14,
            "atr_sl_mult": 2.0,
            "atr_tp_mult": 6.0
        }
    }
}


def get_template_strategy(template_id: str, user_params: dict = None) -> tuple:
    """
    Get pre-built strategy code for a template.
    
    Args:
        template_id: The template identifier (e.g., "rsi-oversold-reversal")
        user_params: Optional dict of parameter overrides from user
        
    Returns:
        Tuple of (code_string, merged_params) or (None, None) if not found
    """
    if template_id not in TEMPLATE_STRATEGIES:
        return None, None
    
    template = TEMPLATE_STRATEGIES[template_id]
    code = template["code"]
    
    # Merge user params with defaults
    params = template["params"].copy()
    if user_params:
        params.update(user_params)
    
    return code, params


def list_templates() -> list:
    """Return list of available template IDs."""
    return list(TEMPLATE_STRATEGIES.keys())

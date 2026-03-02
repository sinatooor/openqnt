"""
Pre-built Python Strategy Templates

These strategies match the frontend templates exactly.
When a user selects a template without modifications, we use this
pre-compiled code directly instead of parsing XML.

Supports two execution engines:
1. backtesting.py - Uses TA-Lib indicators
2. NautilusTrader - Uses NautilusTrader indicator classes
"""

from typing import Optional, Dict, Tuple


# =============================================================================
# NAUTILUS TEMPLATE STRATEGIES
# =============================================================================

# --- Nautilus Template 1: RSI Oversold Reversal ---
NAUTILUS_RSI_OVERSOLD_REVERSAL_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import RelativeStrengthIndex, AverageTrueRange

class GeneratedStrategy(Strategy):
    """RSI Oversold Reversal Strategy for NautilusTrader"""
    
    def __init__(self, config):
        super().__init__(config)
        self.rsi = RelativeStrengthIndex(14)
        self.atr = AverageTrueRange(14)
        self.instrument_id = None
        self._position_open = False
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        self.log.info(f"DEBUG: on_start found {len(instruments)} instruments")
        if instruments:
            self.instrument_id = instruments[0].id
            self.log.info(f"DEBUG: instrument_id set to {self.instrument_id}")
        else:
            self.log.info("DEBUG: No instruments found in cache!")
        self.register_indicator_for_bars(self.bar_type, self.rsi)
        self.register_indicator_for_bars(self.bar_type, self.atr)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.rsi.initialized:
            # print(f"DEBUG: Waiting for init. Instrument: {self.instrument_id}, RSI init: {self.rsi.initialized}")
            return
        
        rsi_val = self.rsi.value
        atr_val = self.atr.value
        price = float(bar.close)
        
        # print(f"DEBUG: Bar {bar.ts_event} | Price: {price} | RSI: {rsi_val} | Pos: {self._position_open}")
        
        # Long when RSI < 30
        if rsi_val < 30 and not self._position_open:
            self.log.info(f"DEBUG: SIGNAL BUY @ {price} (RSI: {rsi_val})")
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=Quantity.from_str("1000"),
                time_in_force=TimeInForce.GTC,
            )
            self.submit_order(order)
            self._position_open = True
        
        # Exit when RSI > 70
        elif rsi_val > 70 and self._position_open:
            self.log.info(f"DEBUG: SIGNAL SELL @ {price} (RSI: {rsi_val})")
            self.close_all_positions(self.instrument_id)
            self._position_open = False
'''

# --- Nautilus Template 2: Simple MA Crossover ---
NAUTILUS_SIMPLE_MA_CROSSOVER_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import SimpleMovingAverage

class GeneratedStrategy(Strategy):
    """Simple MA Crossover Strategy for NautilusTrader"""
    
    def __init__(self, config):
        super().__init__(config)
        self.sma = SimpleMovingAverage(12)
        self.instrument_id = None
        self._position_open = False
        self._prev_close = 0.0
        self._prev_sma = 0.0
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
        self.register_indicator_for_bars(self.bar_type, self.sma)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.sma.initialized:
            return
        
        curr_close = float(bar.close)
        curr_sma = self.sma.value
        
        # Bullish crossover
        if self._prev_close < self._prev_sma and curr_close > curr_sma:
            if not self._position_open:
                order = self.order_factory.market(
                    instrument_id=self.instrument_id,
                    order_side=OrderSide.BUY,
                    quantity=Quantity.from_str("1"),
                    time_in_force=TimeInForce.GTC,
                )
                self.submit_order(order)
                self._position_open = True
        
        # Bearish crossover
        elif self._prev_close > self._prev_sma and curr_close < curr_sma:
            if self._position_open:
                self.close_all_positions(self.instrument_id)
                self._position_open = False
        
        self._prev_close = curr_close
        self._prev_sma = curr_sma
'''

# --- Nautilus Template 3: Bollinger Breakout ---
NAUTILUS_BOLLINGER_BREAKOUT_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import BollingerBands, AverageTrueRange

class GeneratedStrategy(Strategy):
    """Bollinger Band Breakout Strategy for NautilusTrader"""
    
    def __init__(self, config):
        super().__init__(config)
        self.bb = BollingerBands(20, 2.0)
        self.atr = AverageTrueRange(14)
        self.instrument_id = None
        self._position_open = False
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
        self.register_indicator_for_bars(self.bar_type, self.bb)
        self.register_indicator_for_bars(self.bar_type, self.atr)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.bb.initialized:
            return
        
        price = float(bar.close)
        upper = self.bb.upper
        
        # Long on upper band breakout
        if price > upper and not self._position_open:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=Quantity.from_str("1"),
                time_in_force=TimeInForce.GTC,
            )
            self.submit_order(order)
            self._position_open = True
'''

# --- Nautilus Template 4: MACD Momentum ---
NAUTILUS_MACD_MOMENTUM_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import MovingAverageConvergenceDivergence, AverageTrueRange

class GeneratedStrategy(Strategy):
    """MACD Momentum Strategy for NautilusTrader"""
    
    def __init__(self, config):
        super().__init__(config)
        self.macd = MovingAverageConvergenceDivergence(12, 26, 9)
        self.atr = AverageTrueRange(14)
        self.instrument_id = None
        self._position_open = False
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
        self.register_indicator_for_bars(self.bar_type, self.macd)
        self.register_indicator_for_bars(self.bar_type, self.atr)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.macd.initialized:
            return
        
        macd_val = self.macd.value
        signal_val = self.macd.signal
        
        # Long when MACD > Signal
        if macd_val > signal_val and not self._position_open:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=Quantity.from_str("1"),
                time_in_force=TimeInForce.GTC,
            )
            self.submit_order(order)
            self._position_open = True
'''

# --- Nautilus Template 5: VWAP Scalping ---
NAUTILUS_VWAP_SCALPING_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import RelativeStrengthIndex, SimpleMovingAverage

class GeneratedStrategy(Strategy):
    """VWAP Scalping Strategy for NautilusTrader (using SMA as VWAP proxy)"""
    
    def __init__(self, config):
        super().__init__(config)
        self.rsi = RelativeStrengthIndex(9)
        self.vwap_proxy = SimpleMovingAverage(20)  # VWAP proxy
        self.instrument_id = None
        self._position_open = False
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
        self.register_indicator_for_bars(self.bar_type, self.rsi)
        self.register_indicator_for_bars(self.bar_type, self.vwap_proxy)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.rsi.initialized:
            return
        
        price = float(bar.close)
        rsi_val = self.rsi.value
        vwap = self.vwap_proxy.value
        
        # Long when price < VWAP and RSI < 40
        if price < vwap and rsi_val < 40 and not self._position_open:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=Quantity.from_str("1"),
                time_in_force=TimeInForce.GTC,
            )
            self.submit_order(order)
            self._position_open = True
'''

# --- Nautilus Template 6: Triple EMA Trend ---
NAUTILUS_TRIPLE_EMA_TREND_CODE = '''
from decimal import Decimal
import numpy as np
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.objects import Quantity
from nautilus_trader.indicators import ExponentialMovingAverage

class GeneratedStrategy(Strategy):
    """Triple EMA Trend Strategy for NautilusTrader"""
    
    def __init__(self, config):
        super().__init__(config)
        self.ema_fast = ExponentialMovingAverage(8)
        self.ema_medium = ExponentialMovingAverage(21)
        self.ema_slow = ExponentialMovingAverage(55)
        self.instrument_id = None
        self._position_open = False
    
    def on_start(self):
        self.subscribe_bars(self.bar_type)
        instruments = self.cache.instruments()
        if instruments:
            self.instrument_id = instruments[0].id
        self.register_indicator_for_bars(self.bar_type, self.ema_fast)
        self.register_indicator_for_bars(self.bar_type, self.ema_medium)
        self.register_indicator_for_bars(self.bar_type, self.ema_slow)
    
    def on_bar(self, bar: Bar):
        if not self.instrument_id or not self.ema_slow.initialized:
            return
        
        fast = self.ema_fast.value
        medium = self.ema_medium.value
        slow = self.ema_slow.value
        
        # Aligned uptrend: Fast > Medium > Slow
        if fast > medium > slow and not self._position_open:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=Quantity.from_str("1"),
                time_in_force=TimeInForce.GTC,
            )
            self.submit_order(order)
            self._position_open = True
        
        # Exit when alignment breaks
        elif not (fast > medium > slow) and self._position_open:
            self.close_all_positions(self.instrument_id)
            self._position_open = False
'''


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


STATISTICAL_ARBITRAGE_CODE = '''
from backtesting import Strategy
class StatisticalArbitrage(Strategy): pass
'''
HMM_REGIME_SWITCHING_CODE = '''
from backtesting import Strategy
class HMMRegimeSwitching(Strategy): pass
'''
DIVERSIFICATION_ALLOCATION_CODE = '''
from backtesting import Strategy
class DiversificationAllocation(Strategy): pass
'''
PORTFOLIO_REBALANCING_CODE = '''
from backtesting import Strategy
class PortfolioRebalancing(Strategy): pass
'''
PROTECTIVE_PUT_CODE = '''
from backtesting import Strategy
class ProtectivePut(Strategy): pass
'''
OPTIONS_COLLAR_CODE = '''
from backtesting import Strategy
class OptionsCollar(Strategy): pass
'''
TRAILING_STOP_LOSS_CODE = '''
from backtesting import Strategy
from backtesting.test import SMA
from backtesting.lib import crossover

class TrailingStopLoss(Strategy):
    fast_period = 10
    slow_period = 20
    trailing_sl_pct = 0.05
    
    def init(self):
        close = self.data.Close
        self.sma_fast = self.I(SMA, close, self.fast_period)
        self.sma_slow = self.I(SMA, close, self.slow_period)
        
    def next(self):
        if crossover(self.sma_fast, self.sma_slow):
            self.buy(sl=self.data.Close[-1] * (1 - self.trailing_sl_pct))
'''
INVERSE_ETF_HEDGING_CODE = '''
from backtesting import Strategy
from backtesting.test import SMA

class InverseETFHedging(Strategy):
    period = 200
    
    def init(self):
        self.sma = self.I(SMA, self.data.Close, self.period)
        
    def next(self):
        if len(self.data) < self.period: return
        if self.data.Close[-1] < self.sma[-1] and not self.position:
            self.sell()
        elif self.data.Close[-1] > self.sma[-1] and self.position.is_short:
            self.position.close()
'''

# =============================================================================
# TEMPLATE REGISTRY
# =============================================================================
TEMPLATE_STRATEGIES = {
    "rsi-oversold-reversal": {
        "code": RSI_OVERSOLD_REVERSAL_CODE,
        "nautilus_code": NAUTILUS_RSI_OVERSOLD_REVERSAL_CODE,
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
        "nautilus_code": NAUTILUS_SIMPLE_MA_CROSSOVER_CODE,
        "name": "Simple MA Crossover",
        "params": {
            "ma_period": 12
        }
    },
    "bollinger-breakout": {
        "code": BOLLINGER_BREAKOUT_CODE,
        "nautilus_code": NAUTILUS_BOLLINGER_BREAKOUT_CODE,
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
        "nautilus_code": NAUTILUS_MACD_MOMENTUM_CODE,
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
        "nautilus_code": NAUTILUS_VWAP_SCALPING_CODE,
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
        "nautilus_code": NAUTILUS_TRIPLE_EMA_TREND_CODE,
        "name": "Triple EMA Trend",
        "params": {
            "ema_fast": 8,
            "ema_medium": 21,
            "ema_slow": 55,
            "atr_period": 14,
            "atr_sl_mult": 2.0,
            "atr_tp_mult": 6.0
        }
    },
    "statistical-arbitrage": {
        "code": STATISTICAL_ARBITRAGE_CODE,
        "nautilus_code": None,
        "name": "Statistical Arbitrage",
        "params": {}
    },
    "hmm-regime-switching": {
        "code": HMM_REGIME_SWITCHING_CODE,
        "nautilus_code": None,
        "name": "HMM Regime-Switching",
        "params": {}
    },
    "diversification-allocation": {
        "code": DIVERSIFICATION_ALLOCATION_CODE,
        "nautilus_code": None,
        "name": "Diversification & Allocation",
        "params": {}
    },
    "portfolio-rebalancing": {
        "code": PORTFOLIO_REBALANCING_CODE,
        "nautilus_code": None,
        "name": "Portfolio Rebalancing",
        "params": {}
    },
    "protective-put": {
        "code": PROTECTIVE_PUT_CODE,
        "nautilus_code": None,
        "name": "Protective Put",
        "params": {}
    },
    "options-collar": {
        "code": OPTIONS_COLLAR_CODE,
        "nautilus_code": None,
        "name": "Options Collar",
        "params": {}
    },
    "trailing-stop-loss": {
        "code": TRAILING_STOP_LOSS_CODE,
        "nautilus_code": None,
        "name": "Trailing Stop Loss",
        "params": {}
    },
    "inverse-etf-hedging": {
        "code": INVERSE_ETF_HEDGING_CODE,
        "nautilus_code": None,
        "name": "Inverse ETF Hedging",
        "params": {}
    }
}


def get_template_strategy(template_id: str, user_params: dict = None) -> tuple:
    """
    Get pre-built strategy code for a template (backtesting.py version).
    
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


def get_nautilus_template_strategy(template_id: str, user_params: dict = None) -> tuple:
    """
    Get pre-built NautilusTrader strategy code for a template.
    
    Args:
        template_id: The template identifier (e.g., "rsi-oversold-reversal")
        user_params: Optional dict of parameter overrides from user
        
    Returns:
        Tuple of (nautilus_code_string, merged_params) or (None, None) if not found
    """
    if template_id not in TEMPLATE_STRATEGIES:
        return None, None
    
    template = TEMPLATE_STRATEGIES[template_id]
    code = template.get("nautilus_code")
    
    if not code:
        return None, None
    
    # Merge user params with defaults
    params = template["params"].copy()
    if user_params:
        params.update(user_params)
    
    return code, params


def list_templates() -> list:
    """Return list of available template IDs."""
    return list(TEMPLATE_STRATEGIES.keys())


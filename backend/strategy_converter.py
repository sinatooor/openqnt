"""
Strategy Converter

Uses DeepSeek LLM to convert Blockly XML to NautilusTrader Strategy Python code.
"""

import os
import httpx
from typing import Optional

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

NAUTILUS_STRATEGY_PROMPT = """You are an expert Python developer specializing in NautilusTrader algorithmic trading strategies.

Convert the following Blockly XML trading strategy into a complete NautilusTrader Strategy class.

REQUIREMENTS:
1. Create a StrategyConfig class that extends nautilus_trader.trading.strategy.StrategyConfig
2. Create a Strategy class that extends nautilus_trader.trading.strategy.Strategy
3. Include these methods:
   - on_start(): Subscribe to market data
   - on_quote_tick(tick): Handle incoming ticks and check signals
   - on_bar(bar): Handle incoming bars (if using bar data)
   - on_event(event): Handle position events
   - on_stop(): Cleanup
4. Use nautilus_trader.indicators for technical indicators:
   - SimpleMovingAverage for SMA
   - ExponentialMovingAverage for EMA
   - RelativeStrengthIndex for RSI
   - AverageTrueRange for ATR
   - MovingAverageConvergenceDivergence for MACD
   - BollingerBands for Bollinger Bands
5. Submit orders using self.order_factory.market() and self.submit_order()
6. Track position state properly
7. Include proper type hints

INDICATOR MAPPING from Blockly to NautilusTrader:
- ta_sma → SimpleMovingAverage(period=ma_period)  
- ta_ema → ExponentialMovingAverage(period=ma_period)
- ta_rsi → RelativeStrengthIndex(period=ma_period)
- ta_atr → AverageTrueRange(period=ma_period)
- ta_macd → MovingAverageConvergenceDivergence(fast_period, slow_period, signal_period)
- ta_bb → BollingerBands(period=ma_period, k=deviation)

ORDER MAPPING:
- trade_order with DIRECTION=long → OrderSide.BUY
- trade_order with DIRECTION=short → OrderSide.SELL
- trade_stop_loss → Use trailing stop or bracket orders
- trade_take_profit → Use bracket orders with take_profit

BLOCKLY XML:
```xml
{xml}
```

STRATEGY NAME: {strategy_name}
INSTRUMENT: {instrument_id}

Return ONLY the Python code, no explanations. The code must be directly executable."""


async def convert_xml_to_strategy(
    xml: str,
    strategy_name: str = "BlocklyStrategy",
    instrument_id: str = "EUR/USD.SIM"
) -> str:
    """
    Convert Blockly XML to NautilusTrader Strategy Python code using DeepSeek.
    
    Args:
        xml: Blockly workspace XML
        strategy_name: Name for the generated strategy class
        instrument_id: NautilusTrader instrument ID
    
    Returns:
        Python code string for the strategy
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY not configured")
    
    prompt = NAUTILUS_STRATEGY_PROMPT.format(
        xml=xml,
        strategy_name=strategy_name,
        instrument_id=instrument_id
    )
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "You are an expert NautilusTrader developer."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 4000
            }
        )
        
        if response.status_code != 200:
            raise ValueError(f"DeepSeek API error: {response.text}")
        
        data = response.json()
        code = data["choices"][0]["message"]["content"]
        
        # Clean up markdown formatting if present
        if code.startswith("```python"):
            code = code[9:]
        elif code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
        
        return code.strip()


# Example strategy template (used as fallback)
FALLBACK_STRATEGY_TEMPLATE = '''
from decimal import Decimal
from nautilus_trader.core.message import Event
from nautilus_trader.indicators.average.sma import SimpleMovingAverage
from nautilus_trader.model.data import QuoteTick, Bar
from nautilus_trader.model.enums import OrderSide, PositionSide
from nautilus_trader.model.events import PositionOpened, PositionClosed
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.objects import Quantity
from nautilus_trader.model.position import Position
from nautilus_trader.trading.strategy import Strategy, StrategyConfig


class BlocklyStrategyConfig(StrategyConfig):
    """Configuration for the Blockly-generated strategy."""
    instrument_id: InstrumentId
    trade_size: int = 100_000
    fast_period: int = 10
    slow_period: int = 20


class BlocklyStrategy(Strategy):
    """Strategy generated from Blockly XML."""
    
    def __init__(self, config: BlocklyStrategyConfig):
        super().__init__(config=config)
        self.fast_sma = SimpleMovingAverage(config.fast_period)
        self.slow_sma = SimpleMovingAverage(config.slow_period)
        self.trade_size = Quantity.from_int(config.trade_size)
        self.position: Position | None = None
    
    def on_start(self):
        """Subscribe to market data."""
        self.subscribe_quote_ticks(instrument_id=self.config.instrument_id)
    
    def on_stop(self):
        """Cleanup on stop."""
        self.close_all_positions(self.config.instrument_id)
        self.unsubscribe_quote_ticks(instrument_id=self.config.instrument_id)
    
    def on_quote_tick(self, tick: QuoteTick):
        """Process quote ticks and check for signals."""
        mid_price = (tick.bid_price + tick.ask_price) / 2
        self.fast_sma.update_raw(float(mid_price))
        self.slow_sma.update_raw(float(mid_price))
        
        if not self.fast_sma.initialized or not self.slow_sma.initialized:
            return
        
        self.check_signals()
    
    def on_event(self, event: Event):
        """Handle position events."""
        if isinstance(event, PositionOpened):
            self.position = self.cache.position(event.position_id)
        elif isinstance(event, PositionClosed):
            self.position = None
    
    def check_signals(self):
        """Check for entry/exit signals."""
        fast = self.fast_sma.value
        slow = self.slow_sma.value
        
        # Golden cross - go long
        if fast > slow and not self.is_long:
            if self.is_short:
                self.close_position(self.position)
            self.go_long()
        # Death cross - go short
        elif fast < slow and not self.is_short:
            if self.is_long:
                self.close_position(self.position)
            self.go_short()
    
    def go_long(self):
        if self.is_flat:
            order = self.order_factory.market(
                instrument_id=self.config.instrument_id,
                order_side=OrderSide.BUY,
                quantity=self.trade_size,
            )
            self.submit_order(order)
    
    def go_short(self):
        if self.is_flat:
            order = self.order_factory.market(
                instrument_id=self.config.instrument_id,
                order_side=OrderSide.SELL,
                quantity=self.trade_size,
            )
            self.submit_order(order)
    
    @property
    def is_flat(self) -> bool:
        return self.position is None
    
    @property
    def is_long(self) -> bool:
        return self.position and self.position.side == PositionSide.LONG
    
    @property
    def is_short(self) -> bool:
        return self.position and self.position.side == PositionSide.SHORT
'''


def get_fallback_strategy() -> str:
    """Return fallback strategy code if LLM fails."""
    return FALLBACK_STRATEGY_TEMPLATE.strip()

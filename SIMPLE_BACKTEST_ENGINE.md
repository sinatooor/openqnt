# Simple Backtest Engine Documentation

The Simple (Frontend) backtest engine provides fast, LLM-free backtesting by using deterministic XML parsing and template-based Python code generation.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Blockly XML    │ ──▶ │  parse_xml_simple │ ──▶ │  Parsed Dict    │
│  (Strategy)     │     │  (Regex Parser)   │     │  {indicators,   │
└─────────────────┘     └──────────────────┘     │   conditions}   │
                                                   └────────┬────────┘
                                                            │
                                                            ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Backtest       │ ◀── │ generate_strategy │ ◀── │  Strategy Type  │
│  Results        │     │ _code_simple      │     │  Detection      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## How It Works

### Step 1: XML Parsing (`parse_xml_simple`)

The parser uses **regular expressions** to extract indicator blocks and their parameters from Blockly XML:

```python
# Example: Extracting SMA blocks
sma_pattern = r'<block type="ta_sma"[^>]*>.*?<mutation[^>]*ma_period="(\d+)"[^>]*>'
sma_matches = re.findall(sma_pattern, xml, re.DOTALL)
```

### Step 2: Strategy Type Detection

Based on extracted indicators, the engine determines the optimal strategy type:

| Priority | Indicators Found | Strategy Type |
|----------|-----------------|---------------|
| 1 | MACD + RSI | `macd_rsi` |
| 2 | MACD only | `macd` |
| 3 | Bollinger + RSI | `bb_rsi` |
| 4 | Bollinger only | `bollinger` |
| 5 | Stochastic | `stochastic` |
| 6 | 2+ SMA | `sma_crossover` |
| 7 | 2+ EMA | `ema_crossover` |
| 8 | SMA + EMA | `sma_ema` |
| 9 | RSI only | `rsi` |
| 10 | None/Other | `default` (SMA 10/50) |

### Step 3: Python Code Generation

Pre-built templates generate `backtesting.py` compatible Strategy classes:

```python
class GeneratedStrategy(Strategy):
    fast_period = 10
    slow_period = 50
    
    def init(self):
        self.fast_sma = self.I(SMA, self.data.Close, self.fast_period)
        self.slow_sma = self.I(SMA, self.data.Close, self.slow_period)
    
    def next(self):
        if crossover(self.fast_sma, self.slow_sma):
            self.buy()
        elif crossover(self.slow_sma, self.fast_sma):
            if self.position:
                self.position.close()
```

### Step 4: Backtest Execution

The generated code is executed using `backtesting.py`:

```python
bt = Backtest(data, GeneratedStrategy, cash=10000)
stats = bt.run()
```

---

## Supported Indicators

### Moving Averages
| Block Type | Parameters | Default |
|------------|------------|---------|
| `ta_sma` | period | 20 |
| `ta_ema` | period | 20 |

### Oscillators
| Block Type | Parameters | Default |
|------------|------------|---------|
| `ta_rsi` | period | 14 |
| `ta_stochastic` | k_period, d_period | 14, 3 |
| `ta_macd` | fast, slow, signal | 12, 26, 9 |

### Volatility
| Block Type | Parameters | Default |
|------------|------------|---------|
| `ta_bollinger` | period, std | 20, 2.0 |
| `ta_atr` | period | 14 |

---

## Generated Strategy Types

### 1. MACD + RSI Combo (`macd_rsi`)
**Logic:** MACD crossover filtered by RSI to avoid false signals

```
BUY: MACD crosses above Signal AND RSI < 70
SELL: MACD crosses below Signal AND RSI > 30
```

### 2. Pure MACD (`macd`)
**Logic:** Classic MACD line/signal crossover

```
BUY: MACD line crosses above Signal line
SELL: MACD line crosses below Signal line
```

### 3. Bollinger + RSI Combo (`bb_rsi`)
**Logic:** Mean reversion with RSI confirmation

```
BUY: Price touches lower band AND RSI < 30
SELL: Price touches upper band AND RSI > 70
```

### 4. Bollinger Bands (`bollinger`)
**Logic:** Simple mean reversion on band touches

```
BUY: Price <= Lower Band
SELL: Price >= Upper Band
```

### 5. Stochastic (`stochastic`)
**Logic:** %K/%D crossover in extreme zones

```
BUY: %K crosses above %D AND %K < 20 (oversold)
SELL: %K crosses below %D AND %K > 80 (overbought)
```

### 6. SMA Crossover (`sma_crossover`)
**Logic:** Fast SMA crosses slow SMA

```
BUY: Fast SMA crosses above Slow SMA
SELL: Fast SMA crosses below Slow SMA
```

### 7. EMA Crossover (`ema_crossover`)
**Logic:** Fast EMA crosses slow EMA (more responsive than SMA)

```
BUY: Fast EMA crosses above Slow EMA
SELL: Fast EMA crosses below Slow EMA
```

### 8. SMA + EMA (`sma_ema`)
**Logic:** EMA crosses SMA (momentum vs trend)

```
BUY: EMA crosses above SMA
SELL: EMA crosses below SMA
```

### 9. RSI (`rsi`)
**Logic:** Classic oversold/overbought

```
BUY: RSI < 30 (oversold)
SELL: RSI > 70 (overbought)
```

### 10. Default (`default`)
**Logic:** SMA 10/50 crossover fallback

```
BUY: SMA(10) crosses above SMA(50)
SELL: SMA(10) crosses below SMA(50)
```

---

## Comparison with Other Engines

| Feature | Simple (Frontend) | backtesting.py | NautilusTrader | AI Simulation |
|---------|-------------------|----------------|----------------|---------------|
| **LLM Required** | ❌ No | ✅ DeepSeek | ✅ DeepSeek | ✅ Any |
| **Speed** | ⚡ Fast | 🐢 Slower | 🐢 Slower | 🐢🐢 Slowest |
| **Flexibility** | Limited patterns | Any strategy | Institutional | Creative |
| **Network Calls** | None | DeepSeek API | DeepSeek API | LLM API |
| **Accuracy** | Template-based | LLM interprets | LLM interprets | LLM simulates |

---

## Limitations

1. **Pattern-Based**: Only recognizes predefined indicator combinations
2. **No Nested Logic**: Can't understand complex IF/AND/OR conditions
3. **Limited Block Types**: Doesn't support all Blockly blocks
4. **Fixed Templates**: Strategy logic is predetermined, not dynamic

---

## When to Use Simple Engine

✅ **Use Simple when:**
- You want fast results without API calls
- Your strategy uses standard indicator crossovers
- You're testing basic SMA/EMA/RSI/MACD strategies
- Network connectivity is limited

❌ **Use LLM engines when:**
- Your strategy has complex nested conditions
- You're using custom or unusual indicator combinations
- You need the AI to interpret ambiguous block structures
- You want the most accurate XML → code translation

---

## File Location

The parser and generator are in:
```
backend/backtest_service.py
```

Functions:
- `parse_xml_simple(xml: str) -> Dict[str, Any]`
- `generate_strategy_code_simple(parsed: Dict[str, Any]) -> str`

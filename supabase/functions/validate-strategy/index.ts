import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// COMPLETE BLOCK REFERENCE (ALL 91+ BLOCKS)
// ============================================================

const COMPLETE_BLOCK_REFERENCE = `
=== MOVING AVERAGES ===

ta_sma: Simple Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
applied_price options: 0=Close, 1=Open, 2=High, 3=Low, 4=Median, 5=Typical, 6=Weighted
XML:
<block type="ta_sma">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">SMA</field>
</block>

ta_ema: Exponential Moving Average
Components: N/A (single value)
Mutation params: ma_period="12", shift="0", applied_price="0"
XML:
<block type="ta_ema">
  <field name="PERIOD">60</field>
  <mutation ma_period="12" shift="0" applied_price="0"></mutation>
  <field name="NAME">EMA</field>
</block>

ta_smma: Smoothed Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_smma">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">SMMA</field>
</block>

ta_lwma: Linear Weighted Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_lwma">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">LWMA</field>
</block>

ta_dema: Double Exponential Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_dema">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">DEMA</field>
</block>

ta_tema: Triple Exponential Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_tema">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">TEMA</field>
</block>

ta_frama: Fractal Adaptive Moving Average
Components: N/A (single value)
Mutation params: ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_frama">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">FRAMA</field>
</block>

ta_vidya: Variable Index Dynamic Average
Components: N/A (single value)
Mutation params: cmo_period="9", ma_period="14", shift="0", applied_price="0"
XML:
<block type="ta_vidya">
  <field name="PERIOD">60</field>
  <mutation cmo_period="9" ma_period="14" shift="0" applied_price="0"></mutation>
  <field name="NAME">VIDYA</field>
</block>

ta_ama: Adaptive Moving Average
Components: N/A (single value)
Mutation params: ma_period="9", fast_period="2", slow_period="30", shift="0", applied_price="0"
XML:
<block type="ta_ama">
  <field name="PERIOD">60</field>
  <mutation ma_period="9" fast_period="2" slow_period="30" shift="0" applied_price="0"></mutation>
  <field name="NAME">AMA</field>
</block>

=== OSCILLATORS ===

ta_rsi: Relative Strength Index
Components: N/A (single value, range 0-100)
Mutation params: ma_period="14", applied_price="0"
XML:
<block type="ta_rsi">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">RSI</field>
</block>

ta_cci: Commodity Channel Index
Components: N/A (single value)
Mutation params: ma_period="20", applied_price="5"
XML:
<block type="ta_cci">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" applied_price="5"></mutation>
  <field name="NAME">CCI</field>
</block>

ta_williams_r: Williams Percent Range
Components: N/A (single value, range -100 to 0)
Mutation params: ma_period="14"
XML:
<block type="ta_williams_r">
  <field name="PERIOD">60</field>
  <mutation ma_period="14"></mutation>
  <field name="NAME">Williams %R</field>
</block>

ta_mfi: Money Flow Index
Components: N/A (single value, range 0-100)
Mutation params: ma_period="14", applied_volume="0"
XML:
<block type="ta_mfi">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_volume="0"></mutation>
  <field name="NAME">MFI</field>
</block>

ta_momentum: Momentum Indicator
Components: N/A (single value)
Mutation params: ma_period="14", applied_price="0"
XML:
<block type="ta_momentum">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">Momentum</field>
</block>

ta_osma: Moving Average of Oscillator
Components (COMPONENT field): main | signal
Mutation params: fast_period="12", slow_period="26", signal_period="9", applied_price="0"
XML for main:
<block type="ta_osma">
  <field name="PERIOD">60</field>
  <mutation fast_period="12" slow_period="26" signal_period="9" applied_price="0"></mutation>
  <field name="NAME">OsMA</field>
  <field name="COMPONENT">main</field>
</block>

ta_rvi: Relative Vigor Index
Components (COMPONENT field): main | signal
Mutation params: ma_period="10"
XML for main:
<block type="ta_rvi">
  <field name="PERIOD">60</field>
  <mutation ma_period="10"></mutation>
  <field name="NAME">RVI</field>
  <field name="COMPONENT">main</field>
</block>

ta_stochastic: Stochastic Oscillator
Components (COMPONENT field): main | signal
Mutation params: k_period="5", d_period="3", slowing="3", ma_method="0", price_field="0"
ma_method options: 0=SMA, 1=EMA, 2=SMMA, 3=LWMA
XML for main (%K):
<block type="ta_stochastic">
  <field name="PERIOD">60</field>
  <mutation k_period="5" d_period="3" slowing="3" ma_method="0" price_field="0"></mutation>
  <field name="NAME">Stochastic</field>
  <field name="COMPONENT">main</field>
</block>
XML for signal (%D):
<block type="ta_stochastic">
  <field name="PERIOD">60</field>
  <mutation k_period="5" d_period="3" slowing="3" ma_method="0" price_field="0"></mutation>
  <field name="NAME">Stochastic</field>
  <field name="COMPONENT">signal</field>
</block>

ta_trix: Triple Exponential Average
Components: N/A (single value)
Mutation params: ma_period="14", applied_price="0"
XML:
<block type="ta_trix">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">TRIX</field>
</block>

ta_ac: Accelerator Oscillator
Components: N/A (single value)
Mutation params: (none)
XML:
<block type="ta_ac">
  <field name="PERIOD">60</field>
  <field name="NAME">AC</field>
</block>

ta_ao: Awesome Oscillator
Components: N/A (single value)
Mutation params: (none)
XML:
<block type="ta_ao">
  <field name="PERIOD">60</field>
  <field name="NAME">AO</field>
</block>

ta_chaikin: Chaikin Oscillator
Components: N/A (single value)
Mutation params: fast_period="3", slow_period="10", ma_method="1", applied_volume="0"
XML:
<block type="ta_chaikin">
  <field name="PERIOD">60</field>
  <mutation fast_period="3" slow_period="10" ma_method="1" applied_volume="0"></mutation>
  <field name="NAME">Chaikin</field>
</block>

ta_demarker: DeMarker
Components: N/A (single value, range 0-1)
Mutation params: ma_period="14"
XML:
<block type="ta_demarker">
  <field name="PERIOD">60</field>
  <mutation ma_period="14"></mutation>
  <field name="NAME">DeMarker</field>
</block>

ta_force: Force Index
Components: N/A (single value)
Mutation params: ma_period="13", ma_method="0", applied_volume="0"
XML:
<block type="ta_force">
  <field name="PERIOD">60</field>
  <mutation ma_period="13" ma_method="0" applied_volume="0"></mutation>
  <field name="NAME">Force</field>
</block>

=== MACD ===

macd_value: MACD (Moving Average Convergence Divergence)
Components (COMPONENT field): line | signal | histogram
Mutation params: fast_period="12", slow_period="26", signal_period="9", applied_price="0"
XML for MACD Line:
<block type="macd_value">
  <field name="PERIOD">60</field>
  <mutation fast_period="12" slow_period="26" signal_period="9" applied_price="0"></mutation>
  <field name="NAME">MACD</field>
  <field name="COMPONENT">line</field>
</block>
XML for Signal Line:
<block type="macd_value">
  <field name="PERIOD">60</field>
  <mutation fast_period="12" slow_period="26" signal_period="9" applied_price="0"></mutation>
  <field name="NAME">MACD</field>
  <field name="COMPONENT">signal</field>
</block>
XML for Histogram:
<block type="macd_value">
  <field name="PERIOD">60</field>
  <mutation fast_period="12" slow_period="26" signal_period="9" applied_price="0"></mutation>
  <field name="NAME">MACD</field>
  <field name="COMPONENT">histogram</field>
</block>

=== BANDS & CHANNELS ===

ta_bb: Bollinger Bands
Components (COMPONENT field): upper | middle | lower
Mutation params: ma_period="20", deviation="2.0", shift="0", applied_price="0"
XML for Upper Band:
<block type="ta_bb">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" deviation="2.0" shift="0" applied_price="0"></mutation>
  <field name="NAME">BB</field>
  <field name="COMPONENT">upper</field>
</block>
XML for Middle Band:
<block type="ta_bb">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" deviation="2.0" shift="0" applied_price="0"></mutation>
  <field name="NAME">BB</field>
  <field name="COMPONENT">middle</field>
</block>
XML for Lower Band:
<block type="ta_bb">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" deviation="2.0" shift="0" applied_price="0"></mutation>
  <field name="NAME">BB</field>
  <field name="COMPONENT">lower</field>
</block>

ta_envelopes: Envelopes
Components (COMPONENT field): upper | lower
Mutation params: ma_period="14", deviation="0.1", shift="0", ma_method="0", applied_price="0"
XML for Upper:
<block type="ta_envelopes">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" deviation="0.1" shift="0" ma_method="0" applied_price="0"></mutation>
  <field name="NAME">Envelopes</field>
  <field name="COMPONENT">upper</field>
</block>

ta_donchian: Donchian Channel
Components (COMPONENT field): upper | middle | lower
Mutation params: ma_period="20"
XML for Upper:
<block type="ta_donchian">
  <field name="PERIOD">60</field>
  <mutation ma_period="20"></mutation>
  <field name="NAME">Donchian</field>
  <field name="COMPONENT">upper</field>
</block>

ta_keltner: Keltner Channel
Components (COMPONENT field): upper | middle | lower
Mutation params: ma_period="20", atr_period="10", atr_multiplier="2.0"
XML for Upper:
<block type="ta_keltner">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" atr_period="10" atr_multiplier="2.0"></mutation>
  <field name="NAME">Keltner</field>
  <field name="COMPONENT">upper</field>
</block>

=== COMPLEX INDICATORS ===

ta_ichimoku: Ichimoku Kinko Hyo
Components (COMPONENT field): tenkan | kijun | chikou | senkouA | senkouB
Mutation params: tenkanSen="9", kijunSen="26", senkouSpanB="52"
XML for Tenkan-sen (Conversion Line):
<block type="ta_ichimoku">
  <field name="PERIOD">60</field>
  <mutation tenkanSen="9" kijunSen="26" senkouSpanB="52"></mutation>
  <field name="NAME">Ichimoku</field>
  <field name="COMPONENT">tenkan</field>
</block>
XML for Kijun-sen (Base Line):
<block type="ta_ichimoku">
  <field name="PERIOD">60</field>
  <mutation tenkanSen="9" kijunSen="26" senkouSpanB="52"></mutation>
  <field name="NAME">Ichimoku</field>
  <field name="COMPONENT">kijun</field>
</block>
XML for Chikou Span (Lagging Span):
<block type="ta_ichimoku">
  <field name="PERIOD">60</field>
  <mutation tenkanSen="9" kijunSen="26" senkouSpanB="52"></mutation>
  <field name="NAME">Ichimoku</field>
  <field name="COMPONENT">chikou</field>
</block>
XML for Senkou Span A (Leading Span A):
<block type="ta_ichimoku">
  <field name="PERIOD">60</field>
  <mutation tenkanSen="9" kijunSen="26" senkouSpanB="52"></mutation>
  <field name="NAME">Ichimoku</field>
  <field name="COMPONENT">senkouA</field>
</block>
XML for Senkou Span B (Leading Span B):
<block type="ta_ichimoku">
  <field name="PERIOD">60</field>
  <mutation tenkanSen="9" kijunSen="26" senkouSpanB="52"></mutation>
  <field name="NAME">Ichimoku</field>
  <field name="COMPONENT">senkouB</field>
</block>

alligator: Bill Williams Alligator
Components (COMPONENT field): jaw | teeth | lips
Mutation params: jaw_period="13", jaw_shift="8", teeth_period="8", teeth_shift="5", lips_period="5", lips_shift="3", ma_method="2", applied_price="4"
XML for Jaw (Blue, 13-period):
<block type="alligator">
  <field name="PERIOD">60</field>
  <mutation jaw_period="13" jaw_shift="8" teeth_period="8" teeth_shift="5" lips_period="5" lips_shift="3" ma_method="2" applied_price="4"></mutation>
  <field name="NAME">Alligator</field>
  <field name="COMPONENT">jaw</field>
</block>
XML for Teeth (Red, 8-period):
<block type="alligator">
  <field name="PERIOD">60</field>
  <mutation jaw_period="13" jaw_shift="8" teeth_period="8" teeth_shift="5" lips_period="5" lips_shift="3" ma_method="2" applied_price="4"></mutation>
  <field name="NAME">Alligator</field>
  <field name="COMPONENT">teeth</field>
</block>
XML for Lips (Green, 5-period):
<block type="alligator">
  <field name="PERIOD">60</field>
  <mutation jaw_period="13" jaw_shift="8" teeth_period="8" teeth_shift="5" lips_period="5" lips_shift="3" ma_method="2" applied_price="4"></mutation>
  <field name="NAME">Alligator</field>
  <field name="COMPONENT">lips</field>
</block>

gator: Gator Oscillator (Bill Williams)
Components (COMPONENT field): upper | lower
Mutation params: jaw_period="13", jaw_shift="8", teeth_period="8", teeth_shift="5", lips_period="5", lips_shift="3", ma_method="2", applied_price="4"
XML for Upper:
<block type="gator">
  <field name="PERIOD">60</field>
  <mutation jaw_period="13" jaw_shift="8" teeth_period="8" teeth_shift="5" lips_period="5" lips_shift="3" ma_method="2" applied_price="4"></mutation>
  <field name="NAME">Gator</field>
  <field name="COMPONENT">upper</field>
</block>

ta_dmi: Directional Movement Index
Components (COMPONENT field): plusDI | minusDI | adx
Mutation params: ma_period="14", applied_price="0"
XML for +DI:
<block type="ta_dmi">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">DMI</field>
  <field name="COMPONENT">plusDI</field>
</block>
XML for -DI:
<block type="ta_dmi">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">DMI</field>
  <field name="COMPONENT">minusDI</field>
</block>
XML for ADX (via DMI):
<block type="ta_dmi">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">DMI</field>
  <field name="COMPONENT">adx</field>
</block>

ta_adx: Average Directional Index (standalone)
Components: N/A (single value)
Mutation params: ma_period="14", applied_price="0"
XML:
<block type="ta_adx">
  <field name="PERIOD">60</field>
  <mutation ma_period="14" applied_price="0"></mutation>
  <field name="NAME">ADX</field>
</block>

ta_adxwilder: ADX Wilder
Components: N/A (single value)
Mutation params: ma_period="14"
XML:
<block type="ta_adxwilder">
  <field name="PERIOD">60</field>
  <mutation ma_period="14"></mutation>
  <field name="NAME">ADX Wilder</field>
</block>

=== VOLATILITY ===

ta_atr: Average True Range
Components: N/A (single value)
Mutation params: ma_period="14"
XML:
<block type="ta_atr">
  <field name="PERIOD">60</field>
  <mutation ma_period="14"></mutation>
  <field name="NAME">ATR</field>
</block>

ta_stddev: Standard Deviation
Components: N/A (single value)
Mutation params: ma_period="20", deviation="1", shift="0", applied_price="0"
XML:
<block type="ta_stddev">
  <field name="PERIOD">60</field>
  <mutation ma_period="20" deviation="1" shift="0" applied_price="0"></mutation>
  <field name="NAME">StdDev</field>
</block>

=== TREND ===

ta_sar: Parabolic SAR
Components: N/A (single value)
Mutation params: step="0.02", maximum="0.2"
XML:
<block type="ta_sar">
  <field name="PERIOD">60</field>
  <mutation step="0.02" maximum="0.2"></mutation>
  <field name="NAME">SAR</field>
</block>

=== VOLUME ===

ta_obv: On Balance Volume
Components: N/A (single value)
Mutation params: applied_volume="0"
XML:
<block type="ta_obv">
  <field name="PERIOD">60</field>
  <mutation applied_volume="0"></mutation>
  <field name="NAME">OBV</field>
</block>

ta_volumes: Volumes
Components (COMPONENT field): real | tick
Mutation params: applied_volume="0"
XML for Real Volume:
<block type="ta_volumes">
  <field name="PERIOD">60</field>
  <mutation applied_volume="0"></mutation>
  <field name="NAME">Volume</field>
  <field name="COMPONENT">real</field>
</block>

ta_bwmfi: Bill Williams Market Facilitation Index
Components (COMPONENT field): main | plus | minus
Mutation params: applied_volume="0"
XML for main:
<block type="ta_bwmfi">
  <field name="PERIOD">60</field>
  <mutation applied_volume="0"></mutation>
  <field name="NAME">BW MFI</field>
  <field name="COMPONENT">main</field>
</block>

ta_ad: Accumulation/Distribution
Components: N/A (single value)
Mutation params: applied_volume="0"
XML:
<block type="ta_ad">
  <field name="PERIOD">60</field>
  <mutation applied_volume="0"></mutation>
  <field name="NAME">A/D</field>
</block>

ta_vwap: Volume Weighted Average Price
Components: N/A (single value)
Mutation params: (none)
XML:
<block type="ta_vwap">
  <field name="PERIOD">60</field>
  <field name="NAME">VWAP</field>
</block>

=== POWER ===

ta_bearspower: Bears Power
Components: N/A (single value)
Mutation params: ma_period="13"
XML:
<block type="ta_bearspower">
  <field name="PERIOD">60</field>
  <mutation ma_period="13"></mutation>
  <field name="NAME">Bears Power</field>
</block>

ta_bullspower: Bulls Power
Components: N/A (single value)
Mutation params: ma_period="13"
XML:
<block type="ta_bullspower">
  <field name="PERIOD">60</field>
  <mutation ma_period="13"></mutation>
  <field name="NAME">Bulls Power</field>
</block>

=== OTHER INDICATORS ===

ta_fractals: Fractals
Components (COMPONENT field): upper | lower
Mutation params: (none)
XML for Upper Fractal:
<block type="ta_fractals">
  <field name="PERIOD">60</field>
  <field name="NAME">Fractals</field>
  <field name="COMPONENT">upper</field>
</block>

ta_highest: Highest Price
Components: N/A (single value)
Mutation params: count="14", start="0"
XML:
<block type="ta_highest">
  <field name="PERIOD">60</field>
  <mutation count="14" start="0"></mutation>
  <field name="NAME">Highest</field>
</block>

ta_lowest: Lowest Price
Components: N/A (single value)
Mutation params: count="14", start="0"
XML:
<block type="ta_lowest">
  <field name="PERIOD">60</field>
  <mutation count="14" start="0"></mutation>
  <field name="NAME">Lowest</field>
</block>

=== CONTROL BLOCKS ===

control_forever: Main trading loop (REQUIRED)
XML:
<block type="control_forever" x="50" y="50">
  <statement name="DO">
    <!-- inner blocks here -->
  </statement>
</block>

control_if: Conditional execution
XML:
<block type="control_if">
  <value name="CONDITION">
    <!-- condition block here -->
  </value>
  <statement name="DO">
    <!-- action blocks here -->
  </statement>
</block>

control_if_else: Conditional with else branch
XML:
<block type="control_if_else">
  <value name="CONDITION">
    <!-- condition block here -->
  </value>
  <statement name="DO">
    <!-- if-true blocks here -->
  </statement>
  <statement name="ELSE">
    <!-- if-false blocks here -->
  </statement>
</block>

control_repeat: Repeat N times
Fields: TIMES (number of iterations)
XML:
<block type="control_repeat">
  <field name="TIMES">10</field>
  <statement name="DO">
    <!-- inner blocks here -->
  </statement>
</block>

control_repeat_until: Repeat until condition
XML:
<block type="control_repeat_until">
  <value name="CONDITION">
    <!-- condition block here -->
  </value>
  <statement name="DO">
    <!-- inner blocks here -->
  </statement>
</block>

control_wait: Wait for duration
Fields: DURATION (seconds)
XML:
<block type="control_wait">
  <field name="DURATION">1</field>
</block>

control_wait_until: Wait until condition
XML:
<block type="control_wait_until">
  <value name="CONDITION">
    <!-- condition block here -->
  </value>
</block>

control_stop: Stop execution
XML:
<block type="control_stop"></block>

=== OPERATOR BLOCKS ===

Comparison operators:
operator_equals: A == B
operator_not_equals: A != B
operator_greater: A > B
operator_less: A < B
operator_greater_equals: A >= B
operator_less_equals: A <= B

XML format for all comparison operators:
<block type="operator_greater">
  <value name="LEFT">
    <!-- left operand block -->
  </value>
  <value name="RIGHT">
    <!-- right operand block -->
  </value>
</block>

Math operators:
operator_add: A + B
operator_subtract: A - B
operator_multiply: A * B
operator_divide: A / B

XML format for all math operators:
<block type="operator_add">
  <value name="LEFT">
    <!-- left operand block -->
  </value>
  <value name="RIGHT">
    <!-- right operand block -->
  </value>
</block>

Logic operators:
operator_and: A AND B
operator_or: A OR B
operator_not: NOT A

XML for operator_and/operator_or:
<block type="operator_and">
  <value name="LEFT">
    <!-- left condition -->
  </value>
  <value name="RIGHT">
    <!-- right condition -->
  </value>
</block>

XML for operator_not:
<block type="operator_not">
  <value name="OPERAND">
    <!-- condition to negate -->
  </value>
</block>

operator_advanced_math: Advanced math functions
Dropdown OPTIONS: abs | sqrt | sin | cos | tan | log | ln | exp | round | floor | ceil
XML:
<block type="operator_advanced_math">
  <field name="OP">abs</field>
  <value name="NUM">
    <!-- number block -->
  </value>
</block>

=== ENVIRONMENT BLOCKS ===

environment_price: Current price
Dropdown TYPE options: close | open | high | low | median | typical | weighted
XML:
<block type="environment_price">
  <field name="TYPE">close</field>
</block>

environment_spread: Current spread
XML:
<block type="environment_spread"></block>

environment_time: Current time
Fields: COMPONENT (hour | minute | second | day | month | year)
XML:
<block type="environment_time">
  <field name="COMPONENT">hour</field>
</block>

environment_day_of_week: Day of week (0=Sunday, 6=Saturday)
XML:
<block type="environment_day_of_week"></block>

environment_is_market_open: Check if market is open
XML:
<block type="environment_is_market_open"></block>

environment_prev_open_price: Previous candle open
Fields: SHIFT (bars back, default 1)
XML:
<block type="environment_prev_open_price">
  <field name="SHIFT">1</field>
</block>

environment_prev_close_price: Previous candle close
Fields: SHIFT (bars back, default 1)
XML:
<block type="environment_prev_close_price">
  <field name="SHIFT">1</field>
</block>

environment_prev_high_price: Previous candle high
Fields: SHIFT (bars back, default 1)
XML:
<block type="environment_prev_high_price">
  <field name="SHIFT">1</field>
</block>

environment_prev_low_price: Previous candle low
Fields: SHIFT (bars back, default 1)
XML:
<block type="environment_prev_low_price">
  <field name="SHIFT">1</field>
</block>

environment_new_candle_open: Detect new candle opened
Fields: TIMEFRAME (in minutes: 1, 5, 15, 30, 60, 240, 1440, 10080)
XML:
<block type="environment_new_candle_open">
  <field name="TIMEFRAME">60</field>
</block>

environment_new_candle_close: Detect new candle closed
Fields: TIMEFRAME (in minutes)
XML:
<block type="environment_new_candle_close">
  <field name="TIMEFRAME">60</field>
</block>

=== TRADING BLOCKS ===

trade_order: Place a trade order
Fields:
  - TRADE_ID: unique identifier for the trade
  - DIRECTION: long | short
  - SIZE_TYPE (implicit via SIZE value): lots | usd | percent
  - ORDER_TYPE: market | limit
  - LEVERAGE: multiplier (default 1)
XML:
<block type="trade_order">
  <field name="TRADE_ID">my_trade</field>
  <field name="DIRECTION">long</field>
  <value name="SIZE">
    <shadow type="math_number">
      <field name="NUM">0.1</field>
    </shadow>
  </value>
  <field name="LEVERAGE">1</field>
  <field name="ORDER_TYPE">market</field>
</block>

trade_close_all: Close all open positions
XML:
<block type="trade_close_all"></block>

trade_close: Close specific trade
Fields: TRADE_ID
XML:
<block type="trade_close">
  <field name="TRADE_ID">my_trade</field>
</block>

trade_stop_loss: Set stop loss for trade
Fields:
  - CLOSE_TYPE: full | partial
  - TRADE_ID: trade identifier
Value: PRICE (the stop loss price level)
XML:
<block type="trade_stop_loss">
  <field name="CLOSE_TYPE">full</field>
  <field name="TRADE_ID">my_trade</field>
  <value name="PRICE">
    <!-- price calculation block -->
  </value>
</block>

trade_take_profit: Set take profit for trade
Fields:
  - CLOSE_TYPE: full | partial
  - TRADE_ID: trade identifier
Value: PRICE (the take profit price level)
XML:
<block type="trade_take_profit">
  <field name="CLOSE_TYPE">full</field>
  <field name="TRADE_ID">my_trade</field>
  <value name="PRICE">
    <!-- price calculation block -->
  </value>
</block>

trade_pnl_of: Get P&L of a trade
Fields: TRADE_ID
XML:
<block type="trade_pnl_of">
  <field name="TRADE_ID">my_trade</field>
</block>

trade_entry_price: Get entry price of a trade
Fields: TRADE_ID
XML:
<block type="trade_entry_price">
  <field name="TRADE_ID">my_trade</field>
</block>

trade_position_size: Get position size of a trade
Fields: TRADE_ID
XML:
<block type="trade_position_size">
  <field name="TRADE_ID">my_trade</field>
</block>

=== RISK MANAGEMENT BLOCKS ===

risk_position_percent: Calculate position size by risk percentage
Fields: PERCENT (e.g., 1 for 1% risk)
XML:
<block type="risk_position_percent">
  <value name="PERCENT">
    <shadow type="math_number">
      <field name="NUM">1</field>
    </shadow>
  </value>
</block>

risk_kelly_criterion: Kelly Criterion position sizing
Fields: WIN_RATE, WIN_LOSS_RATIO
XML:
<block type="risk_kelly_criterion">
  <value name="WIN_RATE">
    <shadow type="math_number">
      <field name="NUM">0.55</field>
    </shadow>
  </value>
  <value name="WIN_LOSS_RATIO">
    <shadow type="math_number">
      <field name="NUM">1.5</field>
    </shadow>
  </value>
</block>

risk_fixed_amount: Fixed dollar amount position sizing
Fields: AMOUNT
XML:
<block type="risk_fixed_amount">
  <value name="AMOUNT">
    <shadow type="math_number">
      <field name="NUM">100</field>
    </shadow>
  </value>
</block>

risk_trailing_stop: Set trailing stop
Fields: TRADE_ID, DISTANCE (in points/pips)
XML:
<block type="risk_trailing_stop">
  <field name="TRADE_ID">my_trade</field>
  <value name="DISTANCE">
    <shadow type="math_number">
      <field name="NUM">50</field>
    </shadow>
  </value>
</block>

risk_scale_in: Add to position
Fields: TRADE_ID, SIZE
XML:
<block type="risk_scale_in">
  <field name="TRADE_ID">my_trade</field>
  <value name="SIZE">
    <shadow type="math_number">
      <field name="NUM">0.1</field>
    </shadow>
  </value>
</block>

risk_scale_out: Reduce position
Fields: TRADE_ID, PERCENT
XML:
<block type="risk_scale_out">
  <field name="TRADE_ID">my_trade</field>
  <value name="PERCENT">
    <shadow type="math_number">
      <field name="NUM">50</field>
    </shadow>
  </value>
</block>

risk_max_drawdown: Set maximum drawdown limit
Fields: PERCENT
XML:
<block type="risk_max_drawdown">
  <value name="PERCENT">
    <shadow type="math_number">
      <field name="NUM">10</field>
    </shadow>
  </value>
</block>

risk_daily_loss_limit: Set daily loss limit
Fields: PERCENT
XML:
<block type="risk_daily_loss_limit">
  <value name="PERCENT">
    <shadow type="math_number">
      <field name="NUM">5</field>
    </shadow>
  </value>
</block>

=== VARIABLE BLOCKS ===

variables_set: Set variable value
Fields: VAR (variable name)
XML:
<block type="variables_set">
  <field name="VAR">myVariable</field>
  <value name="VALUE">
    <!-- value block -->
  </value>
</block>

variables_get: Get variable value
Fields: VAR (variable name)
XML:
<block type="variables_get">
  <field name="VAR">myVariable</field>
</block>

variables_change: Change variable by amount
Fields: VAR (variable name), VALUE (amount)
XML:
<block type="variables_change">
  <field name="VAR">counter</field>
  <value name="DELTA">
    <shadow type="math_number">
      <field name="NUM">1</field>
    </shadow>
  </value>
</block>

=== MATH BLOCKS ===

math_number: Numeric value (used as shadow in VALUE inputs)
XML:
<shadow type="math_number">
  <field name="NUM">14</field>
</shadow>
`;

// ============================================================
// TRADING LOGIC RULES FOR RATIONALIZATION
// ============================================================

const TRADING_LOGIC_RULES = `
=== TRADING LOGIC RULES (APPLY SILENTLY) ===

MOVING AVERAGE CROSSOVER RULES:
- When comparing two MAs of SAME type (SMA vs SMA, EMA vs EMA):
  * Fast period MUST be < Slow period
  * Standard pairs: 10/20, 12/26, 20/50, 50/200
  * WRONG: Fast=50, Slow=20 → FIX: Swap to Fast=20, Slow=50
  * WRONG: Both same period → FIX: Use 10/20 or 12/26
- BUY signal: Fast MA > Slow MA (bullish crossover)
- SELL signal: Fast MA < Slow MA (bearish crossover)

RSI RULES (Range 0-100):
- Oversold zone: RSI < 30 → BUY opportunity
- Overbought zone: RSI > 70 → SELL opportunity
- WRONG: Buy when RSI > 70 → FIX: Change to RSI < 30
- WRONG: Sell when RSI < 30 → FIX: Change to RSI > 70
- Never use RSI = 50 as threshold (neutral zone)

STOCHASTIC RULES (Range 0-100):
- Oversold: %K < 20, Overbought: %K > 80
- BUY: %K (main) crosses above %D (signal) in oversold zone
- SELL: %K crosses below %D in overbought zone
- Use COMPONENT="main" for %K, COMPONENT="signal" for %D

MACD RULES:
- Bullish: MACD Line (COMPONENT="line") > Signal Line (COMPONENT="signal")
- Bearish: MACD Line < Signal Line
- Histogram > 0 confirms bullish momentum
- WRONG: Comparing same component → FIX: Use line vs signal

BOLLINGER BANDS RULES:
- BUY: Price near Lower band (COMPONENT="lower") + confirmation
- SELL: Price near Upper band (COMPONENT="upper") + confirmation
- Mean reversion: Price crossing middle band
- WRONG: Buy at upper band → FIX: Change to lower band
- WRONG: Sell at lower band → FIX: Change to upper band

ICHIMOKU RULES:
- Bullish: Price above cloud (senkouA & senkouB), Tenkan > Kijun
- Bearish: Price below cloud, Tenkan < Kijun
- Cloud = area between senkouA and senkouB
- Tenkan (9) = fast line, Kijun (26) = slow line
- WRONG: Buy when price below cloud → FIX: Add cloud filter

ALLIGATOR RULES:
- Bullish (trending up): Lips > Teeth > Jaw
- Bearish (trending down): Lips < Teeth < Jaw
- Sleeping (no trend): Lines intertwined - don't trade
- Lips = fast (5), Teeth = medium (8), Jaw = slow (13)

ADX/DMI RULES:
- ADX > 25: Strong trend - use trend-following strategies
- ADX < 20: Weak trend/ranging - use mean-reversion or don't trade
- +DI > -DI: Uptrend, -DI > +DI: Downtrend
- WRONG: Trend strategy with ADX < 20 → Consider adding ADX filter

WILLIAMS %R RULES (Range -100 to 0):
- Oversold: < -80, Overbought: > -20
- BUY: Williams %R < -80
- SELL: Williams %R > -20

CCI RULES:
- Oversold: < -100, Overbought: > +100
- BUY: CCI < -100, SELL: CCI > +100

RISK MANAGEMENT RULES:
- Every entry SHOULD have stop-loss
- Risk:Reward ratio should be at least 1:2
- Stop-loss typically: Entry - (ATR * multiplier) for longs
- Take-profit typically: Entry + (ATR * 2-3) for longs
- Position sizing: 1-2% risk per trade max

TIMEFRAME RULES:
- All TIMEFRAME/PERIOD fields use MINUTES
- 1 hour = 60, 4 hours = 240, 1 day = 1440
- WRONG: TIMEFRAME="1h" → FIX: TIMEFRAME="60"

COMMON MISTAKES TO FIX:
1. Identical indicators in comparison → Assign different periods
2. Wrong RSI/Stochastic thresholds → Swap logic
3. Missing main loop (control_forever) → Add it
4. Buy at resistance, sell at support → Invert
5. MACD: Comparing histogram to 0 when should compare line vs signal
6. Same COMPONENT in multi-output indicators → Use different components
`;

// ============================================================
// RATIONALIZATION PROMPT
// ============================================================

const RATIONALIZATION_PROMPT = `You are a trading strategy optimizer. Analyze the provided Blockly XML and fix any illogical trading patterns.

INSTRUCTIONS:
1. Analyze the strategy logic against established trading rules
2. Identify any illogical patterns that would lose money
3. Fix the XML directly - do NOT explain changes
4. Return ONLY the fixed XML wrapped in <xml></xml> tags
5. If strategy is already logical, return it unchanged

${TRADING_LOGIC_RULES}

AVAILABLE BLOCKS:
${COMPLETE_BLOCK_REFERENCE}

RESPOND WITH ONLY THE FIXED XML. NO EXPLANATIONS.`;

// ============================================================
// VALIDATION UTILITIES
// ============================================================

/**
 * Extract XML content from AI response, handling markdown code blocks
 */
function extractXml(content: string): string | null {
    if (!content) return null;

    let cleaned = content.trim();

    // Remove markdown code blocks if present
    if (cleaned.startsWith("```xml")) {
        cleaned = cleaned.replace(/^```xml\n?/, "").replace(/\n?```$/, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    // Try to find <xml>...</xml> tags
    const xmlMatch = cleaned.match(/<xml[\s\S]*?>[\s\S]*<\/xml>/i);
    if (xmlMatch) {
        return xmlMatch[0];
    }

    // If content starts with <, assume it's XML
    if (cleaned.startsWith("<")) {
        return cleaned;
    }

    return null;
}

/**
 * Check if indicator comparisons have identical parameters (a common LLM error)
 * Returns [isValid, issues[]]
 */
function checkCrossoverValidity(xml: string): [boolean, string[]] {
    const issues: string[] = [];

    // Pattern to find comparison blocks with their content
    const comparisonPattern = /<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>([\s\S]*?)<\/block>/g;

    let match;
    while ((match = comparisonPattern.exec(xml)) !== null) {
        const content = match[2];

        // Extract LEFT and RIGHT values
        const leftMatch = content.match(/<value name="LEFT">([\s\S]*?)<\/value>/);
        const rightMatch = content.match(/<value name="RIGHT">([\s\S]*?)<\/value>/);

        if (leftMatch && rightMatch) {
            const leftContent = leftMatch[1];
            const rightContent = rightMatch[1];

            // Check if both sides use the same indicator type
            const leftIndicator = leftContent.match(/<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"/);
            const rightIndicator = rightContent.match(/<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"/);

            if (leftIndicator && rightIndicator && leftIndicator[1] === rightIndicator[1]) {
                // Same indicator type - check if periods are identical
                const leftPeriod = leftContent.match(/ma_period="(\d+)"/);
                const rightPeriod = rightContent.match(/ma_period="(\d+)"/);

                if (leftPeriod && rightPeriod && leftPeriod[1] === rightPeriod[1]) {
                    issues.push(`Identical ${leftIndicator[1]} indicators with ma_period=${leftPeriod[1]}`);
                }
            }
        }
    }

    return [issues.length === 0, issues];
}

/**
 * Fix identical indicator parameters in crossover comparisons
 * Returns [fixedXml, wasFixed]
 */
function fixCrossoverIndicators(xml: string): [string, boolean] {
    // Default fast/slow periods for different indicators
    const FAST_SLOW_PERIODS: Record<string, [string, string]> = {
        'ta_sma': ['10', '20'],
        'ta_ema': ['12', '26'],
        'ta_rsi': ['7', '14'],
        'ta_cci': ['10', '20'],
        'ta_adx': ['7', '14'],
        'ta_atr': ['7', '14'],
    };

    let wasFixed = false;
    let fixedXml = xml;

    // Find comparisons with identical indicators and fix them
    const comparisonPattern = /(<block type="(operator_greater|operator_less|operator_greater_equals|operator_less_equals)"[^>]*>)([\s\S]*?)(<\/block>)/g;

    fixedXml = xml.replace(comparisonPattern, (fullMatch, openTag, opType, content, closeTag) => {
        // Extract LEFT and RIGHT
        const leftMatch = content.match(/(<value name="LEFT">)([\s\S]*?)(<\/value>)/);
        const rightMatch = content.match(/(<value name="RIGHT">)([\s\S]*?)(<\/value>)/);

        if (!leftMatch || !rightMatch) return fullMatch;

        const leftContent = leftMatch[2];
        const rightContent = rightMatch[2];

        // Check for same indicator type with same period
        const leftIndicator = leftContent.match(/<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"/);
        const rightIndicator = rightContent.match(/<block type="(ta_sma|ta_ema|ta_rsi|ta_cci|ta_adx|ta_atr)"/);

        if (!leftIndicator || !rightIndicator || leftIndicator[1] !== rightIndicator[1]) {
            return fullMatch;
        }

        const indicatorType = leftIndicator[1];
        const leftPeriod = leftContent.match(/ma_period="(\d+)"/);
        const rightPeriod = rightContent.match(/ma_period="(\d+)"/);

        if (!leftPeriod || !rightPeriod || leftPeriod[1] !== rightPeriod[1]) {
            return fullMatch;
        }

        // They're identical - fix them!
        const [fastPeriod, slowPeriod] = FAST_SLOW_PERIODS[indicatorType] || ['10', '20'];

        // Update LEFT to fast, RIGHT to slow
        let newLeftContent = leftContent.replace(/ma_period="\d+"/, `ma_period="${fastPeriod}"`);
        let newRightContent = rightContent.replace(/ma_period="\d+"/, `ma_period="${slowPeriod}"`);

        // Also update the NAME field if present
        newLeftContent = newLeftContent.replace(/<field name="NAME">[^<]*<\/field>/, `<field name="NAME">Fast ${indicatorType.replace('ta_', '').toUpperCase()}</field>`);
        newRightContent = newRightContent.replace(/<field name="NAME">[^<]*<\/field>/, `<field name="NAME">Slow ${indicatorType.replace('ta_', '').toUpperCase()}</field>`);

        wasFixed = true;

        const newContent = content
            .replace(leftMatch[0], `${leftMatch[1]}${newLeftContent}${leftMatch[3]}`)
            .replace(rightMatch[0], `${rightMatch[1]}${newRightContent}${rightMatch[3]}`);

        return `${openTag}${newContent}${closeTag}`;
    });

    return [fixedXml, wasFixed];
}

/**
 * Validate basic XML structure
 */
function validateXmlStructure(xml: string): [boolean, string[]] {
    const issues: string[] = [];

    // Check for basic XML structure
    if (!xml.includes('<xml') || !xml.includes('</xml>')) {
        issues.push('Missing <xml> wrapper tags');
    }

    // Check for at least one block
    if (!xml.includes('<block ')) {
        issues.push('No blocks found in XML');
    }

    // Check for control_forever (main loop)
    if (!xml.includes('type="control_forever"')) {
        issues.push('Missing control_forever (main loop) block');
    }

    // Check for unclosed tags (basic check)
    const openBlocks = (xml.match(/<block /g) || []).length;
    const closeBlocks = (xml.match(/<\/block>/g) || []).length;
    if (openBlocks !== closeBlocks) {
        issues.push(`Mismatched block tags: ${openBlocks} open, ${closeBlocks} close`);
    }

    return [issues.length === 0, issues];
}

/**
 * Apply common fixes to XML
 */
function applyCommonFixes(xml: string): string {
    let fixed = xml;

    // Fix timeframe strings to minutes (e.g., "1h" -> "60")
    const timeframeMap: Record<string, string> = {
        '1m': '1', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '1d': '1440', '1w': '10080',
    };

    Object.entries(timeframeMap).forEach(([str, mins]) => {
        const pattern = new RegExp(`<field name="TIMEFRAME">${str}</field>`, 'gi');
        fixed = fixed.replace(pattern, `<field name="TIMEFRAME">${mins}</field>`);
        const periodPattern = new RegExp(`<field name="PERIOD">${str}</field>`, 'gi');
        fixed = fixed.replace(periodPattern, `<field name="PERIOD">${mins}</field>`);
    });

    // Fix invalid block types that LLM might generate
    // ta_ma -> ta_sma (ta_ma doesn't exist)
    fixed = fixed.replace(/type="ta_ma"/g, 'type="ta_sma"');
    fixed = fixed.replace(/type='ta_ma'/g, "type='ta_sma'");

    // ta_macd -> macd_value (ta_macd doesn't exist in this codebase)
    fixed = fixed.replace(/type="ta_macd"/g, 'type="macd_value"');
    fixed = fixed.replace(/type='ta_macd'/g, "type='macd_value'");

    return fixed;
}

/**
 * Rationalize strategy using LLM (Precise mode only)
 */
async function rationalizeStrategy(xml: string, apiKey: string): Promise<[string, boolean]> {
    console.log("Starting strategy rationalization with Gemini Pro...");
    const startTime = Date.now();

    try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-pro",
                messages: [
                    { role: "system", content: RATIONALIZATION_PROMPT },
                    { role: "user", content: `Analyze and fix this trading strategy XML:\n\n${xml}` },
                ],
                temperature: 0.2,
                max_tokens: 8000,
            }),
        });

        if (!response.ok) {
            console.error("Rationalization API error:", response.status);
            return [xml, false]; // Return original on error
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error("No content in rationalization response");
            return [xml, false];
        }

        const rationalizedXml = extractXml(content);
        if (!rationalizedXml) {
            console.error("Failed to extract XML from rationalization response");
            return [xml, false];
        }

        // Check if XML changed
        const wasModified = rationalizedXml.trim() !== xml.trim();
        const duration = Date.now() - startTime;
        console.log(`Rationalization complete in ${duration}ms, modified=${wasModified}`);

        return [rationalizedXml, wasModified];
    } catch (error) {
        console.error("Rationalization error:", error);
        return [xml, false]; // Return original on error
    }
}

// ============================================================
// SYSTEM PROMPT (condensed version for validated generation)
// ============================================================

const SYSTEM_PROMPT = `You are a trading strategy expert that creates Blockly XML code for visual programming.

CRITICAL RULES:
1. You MUST ONLY use blocks listed below - NO OTHER BLOCKS EXIST
2. You MUST follow the EXACT XML structure shown for each block
3. Block IDs must only contain: letters, numbers, underscores, hyphens
4. All value inputs MUST use <shadow type="math_number"><field name="NUM">value</field></shadow>
5. NEVER invent new block types or modify existing block structures
6. For Stop Loss and Take Profit, ALWAYS use trade_entry_price block with ATR-based offsets
7. Default trade sizing: Use SIZE=5 with SIZE_TYPE="percent" (5% of equity) unless user specifies otherwise. Respect user-requested sizing (lots, USD, or percent).
8. TIMEFRAME: ALL timeframe fields MUST use minute values (60 for 1h, 240 for 4h, 1440 for 1d)
9. CROSSOVER STRATEGIES: When comparing two indicators of the SAME type (e.g., SMA vs SMA):
   - ALWAYS use DIFFERENT settings in the <mutation> element (ma_period, shift, etc.)
   - For moving average crossovers: use Fast (shorter period) vs Slow (longer period)  
   - Standard patterns: Fast SMA (ma_period="10") vs Slow SMA (ma_period="20")
   - Standard patterns: Fast EMA (ma_period="12") vs Slow EMA (ma_period="26")
   - Set the NAME field to reflect the difference: "Fast SMA" vs "Slow SMA"
   - NEVER compare two identical indicators - this makes NO logical sense for trading

${COMPLETE_BLOCK_REFERENCE}

=== EXAMPLE: SMA CROSSOVER STRATEGY ===
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_forever" x="50" y="50">
    <statement name="DO">
      <block type="control_if">
        <value name="CONDITION">
          <block type="environment_new_candle_open">
            <field name="TIMEFRAME">60</field>
          </block>
        </value>
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_sma">
                    <field name="PERIOD">60</field>
                    <mutation ma_period="10" shift="0" applied_price="0"></mutation>
                    <field name="NAME">Fast SMA</field>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="ta_sma">
                    <field name="PERIOD">60</field>
                    <mutation ma_period="20" shift="0" applied_price="0"></mutation>
                    <field name="NAME">Slow SMA</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO">
              <block type="trade_close_all">
                <next>
                  <block type="trade_order">
                    <field name="TRADE_ID">sma_cross_buy</field>
                    <field name="DIRECTION">long</field>
                    <value name="SIZE">
                      <shadow type="math_number">
                        <field name="NUM">0.1</field>
                      </shadow>
                    </value>
                    <field name="LEVERAGE">1</field>
                    <field name="ORDER_TYPE">market</field>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>

IMPORTANT: Return ONLY the XML wrapped in <xml></xml> tags. NO explanations.`;

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { message, currentWorkspace, blockXml, mode } = await req.json();
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            throw new Error("LOVABLE_API_KEY is not configured");
        }

        const blockCount = currentWorkspace ? (currentWorkspace.match(/<block /g) || []).length : 0;
        console.log("Generating validated strategy for:", message);
        console.log("Existing workspace:", !!currentWorkspace, `(${blockCount} blocks)`);

        // Select model based on mode (fast = flash, slow = pro)
        const isFastMode = mode !== "slow";
        const modelName = isFastMode ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";
        console.log(`Mode: ${isFastMode ? 'fast' : 'slow'}, Model: ${modelName}`);

        // Build system prompt
        let systemPrompt = SYSTEM_PROMPT;

        if (blockXml) {
            systemPrompt += `\n\nThe user has shared a specific Blockly block:\n${blockXml}\nIncorporate this block in your response.`;
        }

        // Build user prompt
        const userPrompt = currentWorkspace
            ? `Here is my current trading strategy workspace:\n\n${currentWorkspace}\n\nPlease modify it according to this request: ${message}\n\nIMPORTANT: Return ONLY the complete updated XML wrapped in <xml></xml> tags. No explanations.`
            : `Generate Blockly XML for this trading strategy: ${message}\n\nReturn ONLY the XML wrapped in <xml></xml> tags. No explanations.`;

        console.log("Calling Gemini for strategy generation...");
        const startTime = Date.now();

        // Step 1: Generate strategy
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 8000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("AI gateway error:", response.status, errorText);

            if (response.status === 429) {
                return new Response(
                    JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (response.status === 402) {
                return new Response(
                    JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
                    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            throw new Error(`AI gateway error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("No content in AI response");
        }

        const llmTime = Date.now() - startTime;
        console.log(`LLM response received in ${llmTime}ms`);

        // ============================================================
        // VALIDATION PIPELINE
        // ============================================================

        // Step 2: Extract XML from response
        let xml = extractXml(content);
        if (!xml) {
            console.error("Failed to extract XML from response");
            console.error("Response content:", content.substring(0, 500));
            throw new Error("AI returned invalid response format - no XML found");
        }

        console.log(`Extracted XML: ${xml.length} chars`);

        // Step 3: Apply common fixes (timeframes, sizes)
        xml = applyCommonFixes(xml);

        // Step 4: Validate XML structure
        const [structureValid, structureIssues] = validateXmlStructure(xml);
        if (!structureValid) {
            console.warn("Structure validation issues:", structureIssues);
            // Don't fail, just log - the XML might still work
        }

        // Step 5: Check for crossover issues (identical indicators)
        const [crossoverValid, crossoverIssues] = checkCrossoverValidity(xml);

        let wasAutoFixed = false;
        if (!crossoverValid) {
            console.log("Crossover issues found:", crossoverIssues);
            console.log("Applying programmatic fix...");

            const [fixedXml, wasFixed] = fixCrossoverIndicators(xml);
            if (wasFixed) {
                xml = fixedXml;
                wasAutoFixed = true;
                console.log("Successfully fixed crossover indicators");
            }
        }

        // Step 6: Rationalize strategy (ONLY in Precise/Slow mode)
        let wasRationalized = false;
        if (!isFastMode) {
            console.log("Precise mode: Running strategy rationalization...");
            const [rationalizedXml, modified] = await rationalizeStrategy(xml, LOVABLE_API_KEY);
            xml = rationalizedXml;
            wasRationalized = modified;
        }

        // Count final blocks
        const generatedBlockCount = (xml.match(/<block /g) || []).length;
        const totalTime = Date.now() - startTime;

        console.log(`Generation complete: ${generatedBlockCount} blocks, ${totalTime}ms total, autoFixed=${wasAutoFixed}, rationalized=${wasRationalized}`);

        return new Response(
            JSON.stringify({
                xml,
                blockCount: generatedBlockCount,
                autoFixed: wasAutoFixed,
                wasRationalized,
                generationTimeMs: totalTime
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error in generate-strategy-validated:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

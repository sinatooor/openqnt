import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, currentWorkspace, blockXml } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const blockCount = currentWorkspace ? (currentWorkspace.match(/<block /g) || []).length : 0;
    console.log("Generating strategy for:", message);
    console.log(
      "Has existing workspace:",
      !!currentWorkspace,
      `(${blockCount} blocks, ${(currentWorkspace?.length || 0) / 1024}KB)`,
    );
    console.log("Has specific block attached:", !!blockXml);
    console.log("Is modification request:", !!currentWorkspace);

    let systemPrompt = `You are a trading strategy expert that creates Blockly XML code for visual programming.

CRITICAL RULES:
1. You MUST ONLY use blocks listed below - NO OTHER BLOCKS EXIST
2. You MUST follow the EXACT XML structure shown for each block
3. Block IDs must only contain: letters, numbers, underscores, hyphens (NO special characters like (){}[]/#!)
4. All value inputs MUST use <shadow type="math_number"><field name="NUM">value</field></shadow>
5. NEVER invent new block types or modify existing block structures

=== COMPLETE BLOCK REFERENCE ===

Blockly.Blocks['control_if'] = {
  init: function() {
    this.appendValueInput("CONDITION")
      .setCheck("Boolean")
      .appendField("If");
    this.appendStatementInput("DO")
      .setCheck(["TradeAction", "Control"])
      .appendField("then");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Execute actions if condition is true");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_repeat'] = {
  init: function() {
    this.appendValueInput("TIMES")
      .setCheck("Number")
      .appendField("Repeat");
    this.appendDummyInput()
      .appendField("times");
    this.appendStatementInput("DO")
      .setCheck(["TradeAction", "Control"])
      .appendField("do");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Repeat actions a specified number of times");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_wait'] = {
  init: function() {
    this.appendValueInput("SECONDS")
      .setCheck("Number")
      .appendField("Wait");
    this.appendDummyInput()
      .appendField("seconds");
    this.setInputsInline(true);
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Pause execution for specified seconds");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_forever'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Forever");
    this.appendStatementInput("DO")
      .setCheck(["TradeAction", "Control"])
      .appendField("do");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Repeat actions indefinitely");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_repeat_until'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Repeat until");
    this.appendValueInput("CONDITION")
      .setCheck("Boolean");
    this.appendStatementInput("DO")
      .setCheck(["TradeAction", "Control"])
      .appendField("do");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Repeat actions until condition is true");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_if_else'] = {
  init: function() {
    this.appendValueInput("CONDITION")
      .setCheck("Boolean")
      .appendField("If");
    this.appendStatementInput("DO")
      .setCheck(["TradeAction", "Control"])
      .appendField("then");
    this.appendStatementInput("ELSE")
      .setCheck(["TradeAction", "Control"])
      .appendField("else");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Execute actions if condition is true, otherwise execute else actions");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_wait_until'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Wait until");
    this.appendValueInput("CONDITION")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setNextStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Pause execution until condition is true");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['control_stop'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Stop");
    this.setPreviousStatement(true, ["Control", "TradeAction"]);
    this.setStyle('control_blocks');
    this.setTooltip("Stop execution");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_price'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Price");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current market price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_spread'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Spread");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current bid-ask spread");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_prev_candle_open'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Prev. candle open")
      .appendField(new Blockly.FieldDropdown([
        ["1m", "1m"],
        ["5m", "5m"],
        ["15m", "15m"],
        ["1h", "1h"],
        ["4h", "4h"],
        ["1d", "1d"]
      ]), "TIMEFRAME");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Previous candle open price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_prev_ticker_close'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Prev. ticker close")
      .appendField(new Blockly.FieldDropdown([
        ["1m", "1m"],
        ["5m", "5m"],
        ["15m", "15m"],
        ["1h", "1h"],
        ["4h", "4h"],
        ["1d", "1d"]
      ]), "TIMEFRAME");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Previous ticker close price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_is_market_open'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Is market open?");
    this.setOutput(true, "Boolean");
    this.setStyle('environment_blocks');
    this.setTooltip("Check if market is currently open");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_time'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Time");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current timestamp");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_day_of_week'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Day of week");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current day of the week");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_new_candle_open'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("New candle open")
      .appendField(new Blockly.FieldDropdown([
        ["1m", "1m"],
        ["5m", "5m"],
        ["15m", "15m"],
        ["1h", "1h"],
        ["4h", "4h"],
        ["1d", "1d"]
      ]), "TIMEFRAME");
    this.setOutput(true, "Boolean");
    this.setStyle('environment_blocks');
    this.setTooltip("Check if a new candle just opened");
    this.setHelpUrl("");
  }
};

// Comparison operators
Blockly.Blocks['operator_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("=");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if two values are equal");
  }
};

Blockly.Blocks['operator_greater'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField(">");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is greater than right value");
  }
};

Blockly.Blocks['operator_less'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("<");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is less than right value");
  }
};

Blockly.Blocks['operator_greater_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("≥");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is greater than or equal to right value");
  }
};

Blockly.Blocks['operator_less_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("≤");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is less than or equal to right value");
  }
};

// Math operators
Blockly.Blocks['operator_add'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("+");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Add two values");
  }
};

Blockly.Blocks['operator_subtract'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("-");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Subtract right value from left value");
  }
};

Blockly.Blocks['operator_multiply'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("×");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Multiply two values");
  }
};

Blockly.Blocks['operator_divide'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("÷");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Divide left value by right value");
  }
};

// Logic operators
Blockly.Blocks['operator_and'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck("Boolean");
    this.appendDummyInput()
      .appendField("AND");
    this.appendValueInput("RIGHT")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Returns true if both conditions are true");
  }
};

Blockly.Blocks['operator_or'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck("Boolean");
    this.appendDummyInput()
      .appendField("OR");
    this.appendValueInput("RIGHT")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Returns true if at least one condition is true");
  }
};

Blockly.Blocks['operator_not'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("NOT");
    this.appendValueInput("VALUE")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Inverts the boolean value");
  }
};

Blockly.Blocks['operator_not_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("≠");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if two values are not equal");
  }
};

Blockly.Blocks['operator_advanced_math'] = {
  init: function() {
    this.appendValueInput("VALUE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["abs", "abs"],
        ["sqrt", "sqrt"],
        ["sin", "sin"],
        ["cos", "cos"],
        ["tan", "tan"],
        ["log", "log"],
        ["ln", "ln"],
        ["exp", "exp"],
        ["round", "round"],
        ["floor", "floor"],
        ["ceil", "ceil"]
      ]), "FUNCTION");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Apply advanced math function");
  }
};

Blockly.Blocks['ta_sma'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("SMA");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Simple Moving Average");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_ema'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("EMA");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Exponential Moving Average");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_rsi'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("RSI");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Relative Strength Index");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_macd'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("MACD");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Moving Average Convergence Divergence");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_bb'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("BB");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Bollinger Bands");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_vwap'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("VWAP");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Volume Weighted Average Price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_atr'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("ATR");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Average True Range - volatility indicator");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_stochastic'] = {
  init: function() {
    this.appendValueInput("K_PERIOD")
      .setCheck("Number")
      .appendField("Stochastic K");
    this.appendValueInput("D_PERIOD")
      .setCheck("Number")
      .appendField("D");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Stochastic Oscillator");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_adx'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("ADX");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Average Directional Index - trend strength");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_cci'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("CCI");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Commodity Channel Index");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_williams_r'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("Williams %R");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Williams %R - momentum indicator");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_obv'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("OBV");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("On Balance Volume");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_mfi'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("MFI");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Money Flow Index");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_sar'] = {
  init: function() {
    this.appendValueInput("ACCELERATION")
      .setCheck("Number")
      .appendField("Parabolic SAR - Accel");
    this.appendValueInput("MAX")
      .setCheck("Number")
      .appendField("Max");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Parabolic Stop and Reverse");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_ichimoku'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Ichimoku Cloud");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Ichimoku Cloud indicator");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_vp'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("Volume Profile");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Volume Profile");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_keltner'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("Keltner Channel");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Keltner Channels");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_dmi'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("DMI");
    this.appendDummyInput()
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Directional Movement Index");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_supertrend'] = {
  init: function() {
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("SuperTrend");
    this.appendValueInput("MULTIPLIER")
      .setCheck("Number")
      .appendField("Multiplier");
    this.setInputsInline(true);
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("SuperTrend indicator");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_pivot'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Pivot Points");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Pivot Points (support/resistance)");
    this.setHelpUrl("");
  }
};

Blockly.Blocks["trade_order"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Trade ID:")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.appendDummyInput()
      .appendField("Trade")
      .appendField(
        new Blockly.FieldDropdown([
          ["long", "long"],
          ["short", "short"],
        ]),
        "DIRECTION",
      );
    this.appendDummyInput()
      .appendField("Size")
      .appendField(new Blockly.FieldNumber(100, 0), "SIZE");
    this.appendDummyInput()
      .appendField(
        new Blockly.FieldDropdown([
          ["trade value", "value"],
          ["percent of capital", "percent"],
        ]),
        "SIZE_TYPE",
      );
    this.appendDummyInput()
      .appendField("Leverage")
      .appendField(
        new Blockly.FieldDropdown([
          ["1x", "1"],
          ["2x", "2"],
          ["3x", "3"],
          ["5x", "5"],
          ["10x", "10"],
          ["20x", "20"],
          ["50x", "50"],
          ["100x", "100"],
        ]),
        "LEVERAGE",
      );
    this.appendDummyInput()
      .appendField("Order type:")
      .appendField(
        new Blockly.FieldDropdown([
          ["market", "market"],
          ["limit", "limit"],
        ], this.updateOrderType_.bind(this)),
        "ORDER_TYPE",
      );
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Place a trading order with unique ID");
    this.setHelpUrl("");
  },
  
  updateOrderType_: function(value: string) {
    const limitPriceInput = this.getInput('LIMIT_PRICE');
    if (value === 'limit' && !limitPriceInput) {
      this.appendValueInput("LIMIT_PRICE")
        .setCheck("Number")
        .appendField("At price");
    } else if (value === 'market' && limitPriceInput) {
      this.removeInput('LIMIT_PRICE');
    }
  }
};

Blockly.Blocks["trade_stop_loss"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Place")
      .appendField(
        new Blockly.FieldDropdown([
          ["full", "full"],
          ["partial", "partial"],
        ], this.updateCloseType_.bind(this)),
        "CLOSE_TYPE",
      )
      .appendField("stop loss at");
    this.appendValueInput("PRICE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField("for trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Set stop loss at price");
    this.setHelpUrl("");
  },
  
  updateCloseType_: function(value: string) {
    const percentInput = this.getInput('PERCENT');
    if (value === 'partial' && !percentInput) {
      this.appendDummyInput("PERCENT")
        .appendField(", close")
        .appendField(new Blockly.FieldNumber(50, 1, 100), "PERCENT_VALUE")
        .appendField("% of trade");
      this.moveInputBefore('PERCENT', this.inputList[this.inputList.length - 1].name);
    } else if (value === 'full' && percentInput) {
      this.removeInput('PERCENT');
    }
  }
};

Blockly.Blocks["trade_take_profit"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Place")
      .appendField(
        new Blockly.FieldDropdown([
          ["full", "full"],
          ["partial", "partial"],
        ], this.updateCloseType_.bind(this)),
        "CLOSE_TYPE",
      )
      .appendField("take profit at");
    this.appendValueInput("PRICE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField("for trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Set take profit at price");
    this.setHelpUrl("");
  },
  
  updateCloseType_: function(value: string) {
    const percentInput = this.getInput('PERCENT');
    if (value === 'partial' && !percentInput) {
      this.appendDummyInput("PERCENT")
        .appendField(", close")
        .appendField(new Blockly.FieldNumber(50, 1, 100), "PERCENT_VALUE")
        .appendField("% of trade");
      this.moveInputBefore('PERCENT', this.inputList[this.inputList.length - 1].name);
    } else if (value === 'full' && percentInput) {
      this.removeInput('PERCENT');
    }
  }
};

Blockly.Blocks["trade_close"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Close");
    this.appendValueInput("PERCENT")
      .setCheck("Number")
      .appendField("% of trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Close percentage of trade by ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_pnl_of"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("P&L for trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get profit/loss of trade by ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_entry_price"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Entry price for trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get entry price of trade by ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_position_size"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Position size for trade ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get size of trade by ID");
    this.setHelpUrl("");
  },
};

// Variable blocks
Blockly.Blocks["variables_set"] = {
  init: function () {
    this.appendValueInput("VALUE")
      .appendField("set")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR")
      .appendField("to");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Set a variable to a value");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["variables_get"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("get")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR");
    this.setInputsInline(true);
    this.setOutput(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Get the value of a variable");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["variables_change"] = {
  init: function () {
    this.appendValueInput("DELTA")
      .appendField("change")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR")
      .appendField("by");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Change a variable by adding a value to it");
    this.setHelpUrl("");
  },
};

// Function blocks
Blockly.Blocks["function_define"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("function")
      .appendField(new Blockly.FieldTextInput("myFunction"), "NAME");
    this.appendStatementInput("STACK").appendField("do");
    this.setInputsInline(false);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Define a reusable function");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["function_call"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("call")
      .appendField(new Blockly.FieldTextInput("myFunction"), "NAME");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Call a function");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["function_return"] = {
  init: function () {
    this.appendValueInput("VALUE").appendField("return");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Return a value from a function");
    this.setHelpUrl("");
  },
};

EXAMPLES:

Example 1 - Simple MA Crossover Strategy:
Prompt: "Buy when fast MA crosses above slow MA, sell when it crosses below"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_if" x="50" y="50">
    <value name="CONDITION">
      <block type="operator_greater">
        <value name="LEFT">
          <block type="ta_sma">
            <value name="PERIOD">
              <shadow type="math_number">
                <field name="NUM">20</field>
              </shadow>
            </value>
          </block>
        </value>
        <value name="RIGHT">
          <block type="ta_sma">
            <value name="PERIOD">
              <shadow type="math_number">
                <field name="NUM">50</field>
              </shadow>
            </value>
          </block>
        </value>
      </block>
    </value>
    <statement name="DO">
      <block type="trade_order">
        <field name="TRADE_ID">ma_crossover_trade</field>
        <field name="DIRECTION">long</field>
        <field name="SIZE">100</field>
        <field name="SIZE_TYPE">percent</field>
        <field name="LEVERAGE">1</field>
        <field name="ORDER_TYPE">market</field>
        <next>
          <block type="trade_stop_loss">
            <field name="CLOSE_TYPE">full</field>
            <field name="TRADE_ID">ma_crossover_trade</field>
            <value name="PRICE">
              <shadow type="math_number">
                <field name="NUM">2</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 2 - RSI Oversold Reversal:
Prompt: "Buy when RSI drops below 30, sell when it rises above 70"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_if" x="50" y="50">
    <value name="CONDITION">
      <block type="operator_less">
        <value name="LEFT">
          <block type="ta_rsi">
            <value name="PERIOD">
              <shadow type="math_number">
                <field name="NUM">14</field>
              </shadow>
            </value>
          </block>
        </value>
        <value name="RIGHT">
          <shadow type="math_number">
            <field name="NUM">30</field>
          </shadow>
        </value>
      </block>
    </value>
    <statement name="DO">
      <block type="trade_order">
        <field name="TRADE_ID">rsi_reversal_trade</field>
        <field name="DIRECTION">long</field>
        <field name="SIZE">100</field>
        <field name="SIZE_TYPE">percent</field>
        <field name="LEVERAGE">1</field>
        <field name="ORDER_TYPE">market</field>
        <next>
          <block type="trade_take_profit">
            <field name="CLOSE_TYPE">full</field>
            <field name="TRADE_ID">rsi_reversal_trade</field>
            <value name="PRICE">
              <shadow type="math_number">
                <field name="NUM">5</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 3 - Bollinger Band Breakout:
Prompt: "Enter long when price breaks above upper Bollinger Band"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_if" x="50" y="50">
    <value name="CONDITION">
      <block type="operator_greater">
        <value name="LEFT">
          <block type="environment_price"></block>
        </value>
        <value name="RIGHT">
          <block type="ta_bb">
            <value name="PERIOD">
              <shadow type="math_number">
                <field name="NUM">20</field>
              </shadow>
            </value>
          </block>
        </value>
      </block>
    </value>
    <statement name="DO">
      <block type="trade_order">
        <field name="TRADE_ID">bollinger_breakout_trade</field>
        <field name="DIRECTION">long</field>
        <field name="SIZE">100</field>
        <field name="SIZE_TYPE">value</field>
        <field name="LEVERAGE">1</field>
        <field name="ORDER_TYPE">market</field>
        <next>
          <block type="trade_stop_loss">
            <field name="CLOSE_TYPE">full</field>
            <field name="TRADE_ID">bollinger_breakout_trade</field>
            <value name="PRICE">
              <shadow type="math_number">
                <field name="NUM">1.5</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 4 - MACD Momentum with ADX Filter:
Prompt: "Buy when MACD is positive and ADX is above 25"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="control_if" x="50" y="50">
    <value name="CONDITION">
      <block type="operator_and">
        <value name="LEFT">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="ta_macd"></block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number">
                <field name="NUM">0</field>
              </shadow>
            </value>
          </block>
        </value>
        <value name="RIGHT">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="ta_adx">
                <value name="PERIOD">
                  <shadow type="math_number">
                    <field name="NUM">14</field>
                  </shadow>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number">
                <field name="NUM">25</field>
              </shadow>
            </value>
          </block>
        </value>
      </block>
    </value>
    <statement name="DO">
      <block type="trade_order">
        <field name="TRADE_ID">macd_momentum_trade</field>
        <field name="DIRECTION">long</field>
        <field name="SIZE">100</field>
        <field name="SIZE_TYPE">percent</field>
        <field name="LEVERAGE">2</field>
        <field name="ORDER_TYPE">market</field>
        <next>
          <block type="trade_stop_loss">
            <field name="CLOSE_TYPE">full</field>
            <field name="TRADE_ID">macd_momentum_trade</field>
            <value name="PRICE">
              <shadow type="math_number">
                <field name="NUM">3</field>
              </shadow>
            </value>
            <next>
              <block type="trade_take_profit">
                <field name="CLOSE_TYPE">full</field>
                <field name="TRADE_ID">macd_momentum_trade</field>
                <value name="PRICE">
                  <shadow type="math_number">
                    <field name="NUM">6</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

=== CRITICAL ENFORCEMENT RULES ===

1. ONLY USE THE BLOCKS LISTED ABOVE - NO EXCEPTIONS
   - If a block type is not in the list above, it DOES NOT EXIST
   - DO NOT invent new block types like "trade_exit", "price_action", etc.
   - DO NOT modify field names or value names from what's specified
   
2. XML STRUCTURE MUST MATCH EXACTLY
   - Copy the exact XML structure shown for each block
   - Use the exact field names specified
   - Use the exact value input names

6. POSITION FIRST BLOCK
   - Set x="50" y="50" on the first/top-level block only
   
7. RISK MANAGEMENT
   - Add stop loss or take profit after opening trades when appropriate
   
8. TRADE IDs
   - Use descriptive, unique TRADE_ID for each trade
   - Keep IDs simple and readable

REMEMBER: If you're not sure if a block exists, CHECK THE LIST ABOVE. If it's not there, DON'T USE IT.`;

    // Add block context if provided
    if (blockXml) {
      systemPrompt += `\n\nThe user has shared a specific Blockly block with you. Here is the XML structure:\n\n${blockXml}\n\nPlease focus on this block when generating or modifying the strategy. Analyze what this block does and incorporate it or provide context about it in your response.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: currentWorkspace
              ? `Here is my current trading strategy workspace:\n\n${currentWorkspace}\n\nPlease modify it according to this request: ${message}\n\nIMPORTANT: You MUST only use blocks from the list provided in the system prompt. Do not invent new blocks. Return ONLY the complete updated XML wrapped in <xml></xml> tags. No explanations.`
              : `Generate Blockly XML for this trading strategy: ${message}\n\nIMPORTANT: You MUST only use the 77 blocks listed in the system prompt. Do not invent new blocks. Return ONLY the XML wrapped in <xml></xml> tags. No explanations.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Validate response isn't just whitespace
    if (!content.trim()) {
      throw new Error("AI returned empty response");
    }

    // Validate response size (max 1MB)
    if (content.length > 1024 * 1024) {
      throw new Error("AI response is too large");
    }

    // Extract XML content from response (in case AI added explanation text)
    let xmlContent = content.trim();
    const xmlMatch = xmlContent.match(/<xml[^>]*>[\s\S]*<\/xml>/i);

    if (xmlMatch) {
      xmlContent = xmlMatch[0];
    } else {
      // Check if response contains XML tags at all
      if (!xmlContent.includes("<xml") || !xmlContent.includes("</xml>")) {
        console.error("Invalid AI response - no XML tags found:", xmlContent);
        throw new Error("AI did not generate valid Blockly XML. Please try rephrasing your request.");
      }
    }

    // Validate XML starts with proper root element
    if (!xmlContent.trim().startsWith("<xml")) {
      console.error("Invalid XML format - doesn't start with <xml>:", xmlContent.substring(0, 100));
      throw new Error("Generated XML format is invalid");
    }

    // Validate block IDs don't contain invalid characters
    const invalidIdMatch = xmlContent.match(/id="([^"]*[^a-zA-Z0-9_-][^"]*)"/);
    if (invalidIdMatch) {
      console.error("Invalid block ID detected:", invalidIdMatch[1]);
      throw new Error(`Generated XML contains invalid block ID with special characters: ${invalidIdMatch[1]}`);
    }

    // Count blocks for logging
    const generatedBlockCount = (xmlContent.match(/<block /g) || []).length;
    console.log(`Generated XML validated: ${generatedBlockCount} blocks, ${xmlContent.length} chars`);
    console.log("XML preview:", xmlContent.substring(0, 200) + "...");

    return new Response(JSON.stringify({ xml: xmlContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-strategy:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

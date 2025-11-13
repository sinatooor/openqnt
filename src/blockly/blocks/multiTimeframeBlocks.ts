import * as Blockly from 'blockly';

Blockly.Blocks['mtf_condition'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Multi-Timeframe")
      .appendField(new Blockly.FieldDropdown([
        ["1 Minute", "1m"],
        ["5 Minutes", "5m"],
        ["15 Minutes", "15m"],
        ["1 Hour", "1h"],
        ["4 Hours", "4h"],
        ["1 Day", "1d"]
      ]), "TIMEFRAME");
    this.appendValueInput("CONDITION")
      .setCheck("Boolean")
      .appendField("condition");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('mtf_blocks');
    this.setTooltip("Check a condition on a different timeframe");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['mtf_price'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Price on")
      .appendField(new Blockly.FieldDropdown([
        ["1 Minute", "1m"],
        ["5 Minutes", "5m"],
        ["15 Minutes", "15m"],
        ["1 Hour", "1h"],
        ["4 Hours", "4h"],
        ["1 Day", "1d"]
      ]), "TIMEFRAME");
    this.setOutput(true, "Number");
    this.setStyle('mtf_blocks');
    this.setTooltip("Get price from a specific timeframe");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['mtf_indicator'] = {
  init: function() {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["SMA", "sma"],
        ["EMA", "ema"],
        ["RSI", "rsi"],
        ["MACD", "macd"]
      ]), "INDICATOR")
      .appendField("on")
      .appendField(new Blockly.FieldDropdown([
        ["1 Minute", "1m"],
        ["5 Minutes", "5m"],
        ["15 Minutes", "15m"],
        ["1 Hour", "1h"],
        ["4 Hours", "4h"],
        ["1 Day", "1d"]
      ]), "TIMEFRAME");
    this.appendValueInput("PERIOD")
      .setCheck("Number")
      .appendField("period");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('mtf_blocks');
    this.setTooltip("Calculate indicator on a specific timeframe");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['mtf_trend_aligned'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Trend Aligned")
      .appendField(new Blockly.FieldDropdown([
        ["Bullish", "bullish"],
        ["Bearish", "bearish"]
      ]), "DIRECTION");
    this.appendDummyInput()
      .appendField("across")
      .appendField(new Blockly.FieldDropdown([
        ["1m, 5m, 15m", "short"],
        ["15m, 1h, 4h", "medium"],
        ["1h, 4h, 1d", "long"],
        ["Custom", "custom"]
      ]), "TIMEFRAMES");
    this.setOutput(true, "Boolean");
    this.setStyle('mtf_blocks');
    this.setTooltip("Check if trend is aligned across multiple timeframes");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['mtf_higher_timeframe_bias'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Higher TF Bias")
      .appendField(new Blockly.FieldDropdown([
        ["4 Hours", "4h"],
        ["Daily", "1d"],
        ["Weekly", "1w"]
      ]), "TIMEFRAME");
    this.setOutput(true, "String");
    this.setStyle('mtf_blocks');
    this.setTooltip("Get the trend bias from a higher timeframe (bullish/bearish/neutral)");
    this.setHelpUrl("");
  }
};

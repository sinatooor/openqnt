import * as Blockly from 'blockly';

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

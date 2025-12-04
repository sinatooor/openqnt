import * as Blockly from 'blockly';

import { TIMEFRAME_OPTIONS } from '../../indicators/blocks/timeframes';

Blockly.Blocks['environment_price'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Price");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current market price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_spread'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Spread");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current bid-ask spread");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_prev_candle_open'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Prev. candle open")
      .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "TIMEFRAME");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Previous candle open price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_prev_ticker_close'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Prev. ticker close")
      .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "TIMEFRAME");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Previous ticker close price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_is_market_open'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Is market open?");
    this.setOutput(true, "Boolean");
    this.setStyle('environment_blocks');
    this.setTooltip("Check if market is currently open");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_time'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Time");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current timestamp");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_day_of_week'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Day of week");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current day of the week");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['environment_new_candle_open'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("New candle open")
      .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "TIMEFRAME");
    this.setOutput(true, "Boolean");
    this.setStyle('environment_blocks');
    this.setTooltip("Check if a new candle just opened");
    this.setHelpUrl("");
  }
};

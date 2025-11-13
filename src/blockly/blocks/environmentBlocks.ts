import * as Blockly from 'blockly';

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

Blockly.Blocks['environment_volume'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Volume");
    this.setOutput(true, "EnvironmentValue");
    this.setStyle('environment_blocks');
    this.setTooltip("Current trading volume");
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

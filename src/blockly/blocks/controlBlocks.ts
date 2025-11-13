import * as Blockly from 'blockly';

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

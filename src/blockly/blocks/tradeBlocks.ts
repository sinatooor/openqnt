import * as Blockly from 'blockly';

Blockly.Blocks['trade_order'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Trade")
      .appendField(new Blockly.FieldDropdown([
        ["long", "long"],
        ["short", "short"]
      ]), "DIRECTION");
    this.appendValueInput("SIZE")
      .setCheck("Number")
      .appendField("Size");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["value", "value"],
        ["percent", "percent"]
      ]), "SIZE_TYPE");
    this.appendValueInput("LEVERAGE")
      .setCheck("Number")
      .appendField("Leverage");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["market order", "market"],
        ["limit order", "limit"]
      ]), "ORDER_TYPE");
    this.setInputsInline(false);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Place a trading order");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_stop_loss'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Stop loss at");
    this.appendValueInput("PRICE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField("for")
      .appendField(new Blockly.FieldDropdown([
        ["complete trade", "complete"],
        ["partial", "partial"]
      ]), "TYPE");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set stop loss at price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_take_profit'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Take profit at");
    this.appendValueInput("PRICE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField("for")
      .appendField(new Blockly.FieldDropdown([
        ["complete trade", "complete"],
        ["partial", "partial"]
      ]), "TYPE");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set take profit at price");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_close'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Close")
      .appendField(new Blockly.FieldDropdown([
        ["25%", "25"],
        ["50%", "50"],
        ["75%", "75"],
        ["100%", "100"]
      ]), "PERCENT")
      .appendField("of");
    this.appendValueInput("POSITION")
      .setCheck("String");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Close percentage of position");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_pnl_of'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("P&L of");
    this.appendValueInput("POSITION")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get profit/loss of position");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_entry_price'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Entry price of");
    this.appendValueInput("POSITION")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get entry price of position");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_position_size'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Position size of");
    this.appendValueInput("POSITION")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get size of position");
    this.setHelpUrl("");
  }
};

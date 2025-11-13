import * as Blockly from 'blockly';

Blockly.Blocks['trade_order'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Trade")
      .appendField(new Blockly.FieldDropdown([
        ["long", "long"],
        ["short", "short"]
      ]), "DIRECTION")
      .appendField("ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
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
    this.setTooltip("Place a trading order with unique ID");
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
      .appendField("for trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set stop loss at price for specific trade");
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
      .appendField("for trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set take profit at price for specific trade");
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
      .appendField("of trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Close percentage of trade by ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_pnl_of'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("P&L of trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get profit/loss of trade by ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_entry_price'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Entry price of trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get entry price of trade by ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_position_size'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Position size of trade ID");
    this.appendValueInput("TRADE_ID")
      .setCheck("String");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get size of trade by ID");
    this.setHelpUrl("");
  }
};

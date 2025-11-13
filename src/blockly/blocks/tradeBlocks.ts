import * as Blockly from 'blockly';

Blockly.Blocks['trade_order'] = {
  init: function() {
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("Trade")
      .appendField(new Blockly.FieldDropdown([
        ["long", "long"],
        ["short", "short"]
      ]), "DIRECTION")
      .appendField("ID");
    this.appendValueInput("SIZE")
      .setCheck("Number")
      .appendField("size");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["value", "value"],
        ["percent", "percent"]
      ]), "SIZE_TYPE");
    this.appendValueInput("LEVERAGE")
      .setCheck("Number")
      .appendField("leverage");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["market", "market"],
        ["limit", "limit"]
      ]), "ORDER_TYPE");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Place a trading order with unique ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_stop_loss'] = {
  init: function() {
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendValueInput("PRICE")
      .setCheck("Number")
      .appendField("stop loss at");
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
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendValueInput("PRICE")
      .setCheck("Number")
      .appendField("take profit at");
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
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendDummyInput()
      .appendField("close")
      .appendField(new Blockly.FieldDropdown([
        ["25%", "25"],
        ["50%", "50"],
        ["75%", "75"],
        ["100%", "100"]
      ]), "PERCENT");
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
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendDummyInput()
      .appendField("P&L");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get profit/loss of trade by ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_entry_price'] = {
  init: function() {
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendDummyInput()
      .appendField("entry price");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get entry price of trade by ID");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_position_size'] = {
  init: function() {
    this.appendValueInput("TRADE_ID")
      .setCheck("String")
      .appendField("ID");
    this.appendDummyInput()
      .appendField("position size");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('trade_blocks');
    this.setTooltip("Get size of trade by ID");
    this.setHelpUrl("");
  }
};

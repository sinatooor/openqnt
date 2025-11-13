import * as Blockly from 'blockly';

Blockly.Blocks['trade_buy'] = {
  init: function() {
    this.appendValueInput("AMOUNT")
      .setCheck(["Number", "EnvironmentValue", "TAValue"])
      .appendField("Buy");
    this.appendDummyInput()
      .appendField("amount");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Place a buy order");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_sell'] = {
  init: function() {
    this.appendValueInput("AMOUNT")
      .setCheck(["Number", "EnvironmentValue", "TAValue"])
      .appendField("Sell");
    this.appendDummyInput()
      .appendField("amount");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Place a sell order");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_stop_loss'] = {
  init: function() {
    this.appendValueInput("PERCENT")
      .setCheck("Number")
      .appendField("Stop Loss");
    this.appendDummyInput()
      .appendField("%");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set stop loss percentage");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['trade_take_profit'] = {
  init: function() {
    this.appendValueInput("PERCENT")
      .setCheck("Number")
      .appendField("Take Profit");
    this.appendDummyInput()
      .appendField("%");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle('trade_blocks');
    this.setTooltip("Set take profit percentage");
    this.setHelpUrl("");
  }
};

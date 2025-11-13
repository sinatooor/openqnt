import * as Blockly from "blockly";

Blockly.Blocks["trade_order"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("Trade")
      .appendField(
        new Blockly.FieldDropdown([
          ["long", "long"],
          ["short", "short"],
        ]),
        "DIRECTION",
      )
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.appendValueInput("SIZE").setCheck("Number").appendField("size");
    this.appendDummyInput().appendField(
      new Blockly.FieldDropdown([
        ["value", "value"],
        ["percent", "percent"],
      ]),
      "SIZE_TYPE",
    );
    this.appendDummyInput()
      .appendField("leverage")
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
    this.appendDummyInput().appendField(
      new Blockly.FieldDropdown([
        ["market", "market"],
        ["limit", "limit"],
      ]),
      "ORDER_TYPE",
    );
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Place a trading order with unique ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_stop_loss"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.appendValueInput("PRICE").setCheck("Number").appendField("place stop loss at");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Set stop loss at price for specific trade");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_take_profit"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.appendValueInput("PRICE").setCheck("Number").appendField("place take profit at");
    this.setInputsInline(true);
    this.setPreviousStatement(true, "TradeAction");
    this.setNextStatement(true, "TradeAction");
    this.setStyle("trade_blocks");
    this.setTooltip("Set take profit at price for specific trade");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_close"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
    this.appendDummyInput()
      .appendField("close")
      .appendField(
        new Blockly.FieldDropdown([
          ["25%", "25"],
          ["50%", "50"],
          ["75%", "75"],
          ["100%", "100"],
        ]),
        "PERCENT",
      );
    this.setInputsInline(true);
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
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID")
      .appendField("P&L");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get profit/loss of trade by ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_entry_price"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID")
      .appendField("entry price");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get entry price of trade by ID");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["trade_position_size"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ID")
      .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID")
      .appendField("position size");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle("trade_blocks");
    this.setTooltip("Get size of trade by ID");
    this.setHelpUrl("");
  },
};

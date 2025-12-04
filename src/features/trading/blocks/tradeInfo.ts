import * as Blockly from "blockly";

Blockly.Blocks["trade_close"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Close");
        this.appendValueInput("PERCENT")
            .setCheck("Number")
            .appendField("% of trade ID")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
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
            .appendField("P&L for trade ID")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
        this.setOutput(true, "Number");
        this.setStyle("trade_blocks");
        this.setTooltip("Get profit/loss of trade by ID");
        this.setHelpUrl("");
    },
};

Blockly.Blocks["trade_entry_price"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Entry price for trade ID")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
        this.setOutput(true, "Number");
        this.setStyle("trade_blocks");
        this.setTooltip("Get entry price of trade by ID");
        this.setHelpUrl("");
    },
};

Blockly.Blocks["trade_position_size"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Position size for trade ID")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
        this.setOutput(true, "Number");
        this.setStyle("trade_blocks");
        this.setTooltip("Get size of trade by ID");
        this.setHelpUrl("");
    },
};

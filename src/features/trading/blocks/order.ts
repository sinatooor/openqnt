import * as Blockly from "blockly";

Blockly.Blocks["trade_order"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Place Order")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
        this.appendDummyInput()
            .appendField("Direction")
            .appendField(
                new Blockly.FieldDropdown([
                    ["Long", "long"],
                    ["Short", "short"],
                ]),
                "DIRECTION",
            );
        this.appendDummyInput()
            .appendField("Size")
            .appendField(new Blockly.FieldNumber(0.1, 0), "SIZE")
            .appendField(
                new Blockly.FieldDropdown([
                    ["Lots", "lots"],
                    ["USD", "usd"],
                    ["% Equity", "percent"],
                ]),
                "SIZE_TYPE"
            );


        this.appendDummyInput()
            .appendField("Order type:")
            .appendField(
                new Blockly.FieldDropdown([
                    ["Market", "market"],
                    ["Limit", "limit"],
                ], this.updateOrderType_.bind(this)),
                "ORDER_TYPE",
            );
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle("trade_blocks");
        this.setTooltip("Place a trading order with unique ID");
        this.setHelpUrl("");
    },

    updateOrderType_: function (value: string) {
        const limitPriceInput = this.getInput('LIMIT_PRICE');
        if (value === 'limit' && !limitPriceInput) {
            this.appendValueInput("LIMIT_PRICE")
                .setCheck("Number")
                .appendField("At price");
        } else if (value === 'market' && limitPriceInput) {
            this.removeInput('LIMIT_PRICE');
        }
    }
};

Blockly.Blocks["trade_close_all"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Close All Trades");
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle("trade_blocks");
        this.setTooltip("Close all open trades for this strategy");
        this.setHelpUrl("");
    }
};

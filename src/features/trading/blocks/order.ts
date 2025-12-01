import * as Blockly from "blockly";

Blockly.Blocks["trade_order"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Trade ID:")
            .appendField(new Blockly.FieldTextInput("trade1"), "TRADE_ID");
        this.appendDummyInput()
            .appendField("Trade")
            .appendField(
                new Blockly.FieldDropdown([
                    ["long", "long"],
                    ["short", "short"],
                ]),
                "DIRECTION",
            );
        this.appendDummyInput()
            .appendField("Size")
            .appendField(new Blockly.FieldNumber(100, 0), "SIZE");
        this.appendDummyInput()
            .appendField(
                new Blockly.FieldDropdown([
                    ["trade value", "value"],
                    ["percent of capital", "percent"],
                ]),
                "SIZE_TYPE",
            );
        this.appendDummyInput()
            .appendField("Leverage")
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
        this.appendDummyInput()
            .appendField("Order type:")
            .appendField(
                new Blockly.FieldDropdown([
                    ["market", "market"],
                    ["limit", "limit"],
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

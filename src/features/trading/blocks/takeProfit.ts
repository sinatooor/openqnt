import * as Blockly from "blockly";

Blockly.Blocks["trade_take_profit"] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Place")
            .appendField(
                new Blockly.FieldDropdown([
                    ["full", "full"],
                    ["partial", "partial"],
                ], this.updateCloseType_.bind(this)),
                "CLOSE_TYPE",
            )
            .appendField("take profit at");
        this.appendValueInput("PRICE")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("for trade ID")
            .appendField(new Blockly.FieldTextInput("Trade ID"), "TRADE_ID");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle("trade_blocks");
        this.setTooltip("Set take profit at price");
        this.setHelpUrl("");
    },

    updateCloseType_: function (value: string) {
        const percentInput = this.getInput('PERCENT');
        if (value === 'partial' && !percentInput) {
            this.appendDummyInput("PERCENT")
                .appendField(", close")
                .appendField(new Blockly.FieldNumber(50, 1, 100), "PERCENT_VALUE")
                .appendField("% of trade");
            this.moveInputBefore('PERCENT', this.inputList[this.inputList.length - 1].name);
        } else if (value === 'full' && percentInput) {
            this.removeInput('PERCENT');
        }
    }
};

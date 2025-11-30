import * as Blockly from 'blockly';

// Risk Management Actions
Blockly.Blocks['risk_trailing_stop'] = {
    init: function () {
        this.appendValueInput("PERCENT")
            .setCheck("Number")
            .appendField("Trailing Stop");
        this.appendDummyInput()
            .appendField("%");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle('risk_blocks');
        this.setTooltip("Set trailing stop loss that moves with price");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_scale_in'] = {
    init: function () {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Scale In");
        this.appendValueInput("INTERVALS")
            .setCheck("Number")
            .appendField("intervals");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle('risk_blocks');
        this.setTooltip("Scale into position gradually");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_scale_out'] = {
    init: function () {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Scale Out");
        this.appendValueInput("INTERVALS")
            .setCheck("Number")
            .appendField("intervals");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle('risk_blocks');
        this.setTooltip("Scale out of position gradually");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_max_drawdown'] = {
    init: function () {
        this.appendValueInput("PERCENT")
            .setCheck("Number")
            .appendField("Max Drawdown Protection");
        this.appendDummyInput()
            .appendField("%");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle('risk_blocks');
        this.setTooltip("Stop trading if drawdown exceeds threshold");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_daily_loss_limit'] = {
    init: function () {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Daily Loss Limit");
        this.appendDummyInput()
            .appendField("$");
        this.setInputsInline(true);
        this.setPreviousStatement(true, "TradeAction");
        this.setNextStatement(true, "TradeAction");
        this.setStyle('risk_blocks');
        this.setTooltip("Stop trading if daily loss exceeds limit");
        this.setHelpUrl("");
    }
};

import * as Blockly from 'blockly';

// Position Sizing
Blockly.Blocks['risk_position_percent'] = {
    init: function () {
        this.appendValueInput("PERCENT")
            .setCheck("Number")
            .appendField("Position Size");
        this.appendDummyInput()
            .appendField("% of capital");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setStyle('risk_blocks');
        this.setTooltip("Calculate position size as percentage of capital");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_kelly_criterion'] = {
    init: function () {
        this.appendValueInput("WIN_RATE")
            .setCheck("Number")
            .appendField("Kelly Criterion - Win Rate");
        this.appendValueInput("WIN_LOSS_RATIO")
            .setCheck("Number")
            .appendField("Win/Loss Ratio");
        this.setInputsInline(false);
        this.setOutput(true, "Number");
        this.setStyle('risk_blocks');
        this.setTooltip("Calculate optimal position size using Kelly Criterion");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['risk_fixed_amount'] = {
    init: function () {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Fixed Position");
        this.appendDummyInput()
            .appendField("units");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setStyle('risk_blocks');
        this.setTooltip("Fixed position size in units");
        this.setHelpUrl("");
    }
};

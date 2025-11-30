import * as Blockly from 'blockly';

Blockly.Blocks['ta_ema'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("EMA");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Exponential Moving Average");
        this.setHelpUrl("");
    }
};

import * as Blockly from 'blockly';

Blockly.Blocks['ta_sma'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("SMA");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Simple Moving Average");
        this.setHelpUrl("");
    }
};

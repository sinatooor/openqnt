import * as Blockly from 'blockly';

Blockly.Blocks['ta_rsi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("RSI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Relative Strength Index");
        this.setHelpUrl("");
    }
};

import * as Blockly from 'blockly';

Blockly.Blocks['ta_adx'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("ADX");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Average Directional Index - trend strength");
        this.setHelpUrl("");
    }
};

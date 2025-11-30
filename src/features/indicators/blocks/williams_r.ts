import * as Blockly from 'blockly';

Blockly.Blocks['ta_williams_r'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Williams %R");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Williams %R - momentum indicator");
        this.setHelpUrl("");
    }
};

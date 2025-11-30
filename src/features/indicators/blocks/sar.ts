import * as Blockly from 'blockly';

Blockly.Blocks['ta_sar'] = {
    init: function () {
        this.appendValueInput("ACCELERATION")
            .setCheck("Number")
            .appendField("Parabolic SAR - Accel");
        this.appendValueInput("MAX")
            .setCheck("Number")
            .appendField("Max");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Parabolic Stop and Reverse");
        this.setHelpUrl("");
    }
};

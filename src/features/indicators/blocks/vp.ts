import * as Blockly from 'blockly';

Blockly.Blocks['ta_vp'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Volume Profile");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Volume Profile");
        this.setHelpUrl("");
    }
};

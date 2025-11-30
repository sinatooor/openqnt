import * as Blockly from 'blockly';

Blockly.Blocks['ta_dmi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("DMI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Directional Movement Index");
        this.setHelpUrl("");
    }
};

import * as Blockly from 'blockly';

Blockly.Blocks['ta_mfi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("MFI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Money Flow Index");
        this.setHelpUrl("");
    }
};

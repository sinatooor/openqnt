import * as Blockly from 'blockly';

Blockly.Blocks['ta_keltner'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Keltner Channel");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Keltner Channels");
        this.setHelpUrl("");
    }
};

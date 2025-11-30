import * as Blockly from 'blockly';

Blockly.Blocks['ta_bb'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("BB");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Bollinger Bands");
        this.setHelpUrl("");
    }
};

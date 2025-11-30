import * as Blockly from 'blockly';

Blockly.Blocks['ta_cci'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("CCI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Commodity Channel Index");
        this.setHelpUrl("");
    }
};

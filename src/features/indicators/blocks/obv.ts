import * as Blockly from 'blockly';

Blockly.Blocks['ta_obv'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("OBV");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("On Balance Volume");
        this.setHelpUrl("");
    }
};

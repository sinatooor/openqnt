import * as Blockly from 'blockly';

Blockly.Blocks['ta_ichimoku'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Ichimoku Cloud");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Ichimoku Cloud indicator");
        this.setHelpUrl("");
    }
};

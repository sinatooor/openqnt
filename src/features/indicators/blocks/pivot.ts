import * as Blockly from 'blockly';

Blockly.Blocks['ta_pivot'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Pivot Points");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Pivot Points (support/resistance)");
        this.setHelpUrl("");
    }
};

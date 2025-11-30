import * as Blockly from 'blockly';

Blockly.Blocks['ta_vwap'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("VWAP");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Volume Weighted Average Price");
        this.setHelpUrl("");
    }
};

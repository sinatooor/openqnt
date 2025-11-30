import * as Blockly from 'blockly';

Blockly.Blocks['ta_supertrend'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("SuperTrend");
        this.appendValueInput("MULTIPLIER")
            .setCheck("Number")
            .appendField("Multiplier");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("SuperTrend indicator");
        this.setHelpUrl("");
    }
};

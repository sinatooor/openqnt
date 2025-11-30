import * as Blockly from 'blockly';

Blockly.Blocks['ta_atr'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("ATR");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Average True Range - volatility indicator");
        this.setHelpUrl("");
    }
};

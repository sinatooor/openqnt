import * as Blockly from 'blockly';

Blockly.Blocks['ta_stochastic'] = {
    init: function () {
        this.appendValueInput("K_PERIOD")
            .setCheck("Number")
            .appendField("Stochastic K");
        this.appendValueInput("D_PERIOD")
            .setCheck("Number")
            .appendField("D");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Stochastic Oscillator");
        this.setHelpUrl("");
    }
};

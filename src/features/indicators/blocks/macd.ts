import * as Blockly from 'blockly';

/**
 * MACD Block with component selector (Line, Signal, Histogram)
 */
Blockly.Blocks['macd_value'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("MACD")
            .appendField(new Blockly.FieldDropdown([
                ["Line", "line"],
                ["Signal", "signal"],
                ["Histogram", "histogram"]
            ]), "COMPONENT");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Moving Average Convergence Divergence - Select component");
    }
};

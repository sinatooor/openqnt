import * as Blockly from 'blockly';

/**
 * MACD Block with Component Selector
 * Returns the selected MACD component (Line, Signal, or Histogram)
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
        this.setOutput(true, "Number");
        this.setStyle('ta_blocks');
        this.setTooltip("MACD Component (Line/Signal/Histogram)");
        this.setHelpUrl("");
    }
};

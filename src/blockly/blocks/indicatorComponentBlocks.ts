import * as Blockly from 'blockly';

Blockly.Blocks['ta_component_macd_line'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("MACD Line");
        this.setOutput(true, "Number");
        this.setStyle('component_blocks');
        this.setTooltip("The MACD line value");
    }
};

Blockly.Blocks['ta_component_signal_line'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Signal Line");
        this.setOutput(true, "Number");
        this.setStyle('component_blocks');
        this.setTooltip("The Signal line value");
    }
};

Blockly.Blocks['ta_component_histogram'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Histogram");
        this.setOutput(true, "Number");
        this.setStyle('component_blocks');
        this.setTooltip("The MACD Histogram value");
    }
};

Blockly.Blocks['ta_component_rsi_value'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("RSI Value");
        this.setOutput(true, "Number");
        this.setStyle('component_blocks');
        this.setTooltip("The RSI value");
    }
};

// Export a toolbox definition for these blocks
export const indicatorComponentToolbox = {
    'ta_macd': [
        {
            kind: "block",
            type: "ta_component_macd_line"
        },
        {
            kind: "block",
            type: "ta_component_signal_line"
        },
        {
            kind: "block",
            type: "ta_component_histogram"
        }
    ],
    'ta_rsi': [
        {
            kind: "block",
            type: "ta_component_rsi_value"
        }
    ]
};

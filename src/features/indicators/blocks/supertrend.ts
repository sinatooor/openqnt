import * as Blockly from 'blockly';
import { TIMEFRAME_OPTIONS } from "./timeframes";

Blockly.Blocks['ta_supertrend'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("SuperTrend");
        this.appendDummyInput()
            .appendField("Period")
            .appendField(new Blockly.FieldNumber(10, 1), "PERIOD_VALUE");
        this.appendDummyInput()
            .appendField("Multiplier")
            .appendField(new Blockly.FieldNumber(3, 0.1), "MULTIPLIER");
        this.appendDummyInput()
            .appendField("Name")
            .appendField(new Blockly.FieldTextInput("SuperTrend"), "NAME");
        this.appendDummyInput()
            .appendField("Timeframe")
            .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD");

        this.setOutput(true, "Number");
        this.setStyle('indicator_blocks');
        this.setTooltip("SuperTrend Indicator");
        this.setHelpUrl("");
        this.setFieldValue('60', 'PERIOD');
    }
};

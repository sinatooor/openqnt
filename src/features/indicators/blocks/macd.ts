import { TIMEFRAME_OPTIONS } from "./timeframes";
import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

/**
 * MACD Block with component selector (Line, Signal, Histogram) and settings button
 */
Blockly.Blocks['macd_value'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("MACD")
            .appendField(new Blockly.FieldTextInput("MACD"), "NAME")
            .appendField(new Blockly.FieldDropdown([
                ["Line", "line"],
                ["Signal", "signal"],
                ["Histogram", "histogram"]
            ]), "COMPONENT")
            .appendField("TF:").appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD").appendField(createGearSettingsButton('macd'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Moving Average Convergence Divergence - Select component");

        // Initialize default params
        this.indicatorName = 'macd';
        this.indicatorParams = getDefaultParams('macd');
        this.setFieldValue('60', 'PERIOD');
    },

    mutationToDom: function () {
        const container = Blockly.utils.xml.createElement('mutation');
        if (this.indicatorParams) {
            Object.keys(this.indicatorParams).forEach(key => {
                container.setAttribute(key, String(this.indicatorParams[key]));
            });
        }
        return container;
    },

    domToMutation: function (xmlElement: Element) {
        this.indicatorParams = {};
        Array.from(xmlElement.attributes).forEach(attr => {
            if (attr.name !== 'type') {
                this.indicatorParams[attr.name] = parseFloat(attr.value) || 0;
            }
        });
        if (this.indicatorParams["period"]) {
            this.setFieldValue(String(this.indicatorParams["period"]), "PERIOD");
        }
    }
};

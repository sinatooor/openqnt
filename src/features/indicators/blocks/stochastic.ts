import { TIMEFRAME_OPTIONS } from "./timeframes";
import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getIndicatorConfig, getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['ta_stochastic'] = {
    init: function () {
        const config = getIndicatorConfig('stochastic');
        this.appendDummyInput()
            .appendField("Stochastic")
            .appendField(new Blockly.FieldTextInput("Stochastic"), "NAME")
            .appendField(new Blockly.FieldDropdown(
                config?.components?.map(c => [c.label, c.value]) || []
            ), "COMPONENT")
            .appendField("TF:").appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD").appendField(createGearSettingsButton('stochastic'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Stochastic Oscillator");
        this.indicatorName = 'stochastic';
        this.indicatorParams = getDefaultParams('stochastic');
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

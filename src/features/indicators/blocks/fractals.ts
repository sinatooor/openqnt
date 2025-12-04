import { TIMEFRAME_OPTIONS } from "./timeframes";
import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getIndicatorConfig, getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['fractals'] = {
    init: function () {
        const config = getIndicatorConfig('fractals');
        this.appendDummyInput()
            .appendField("Fractals")
            .appendField(new Blockly.FieldTextInput("Fractals"), "NAME")
            .appendField(new Blockly.FieldDropdown(
                config?.components?.map(c => [c.label, c.value]) || []
            ), "COMPONENT")
            .appendField("TF:")
            .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Fractals");
        this.indicatorName = 'fractals';
        this.indicatorParams = getDefaultParams('fractals');
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


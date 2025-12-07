import { TIMEFRAME_OPTIONS } from "./timeframes";
import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['ta_adx'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("ADX")
            .appendField(new Blockly.FieldTextInput("ADX"), "NAME")
            .appendField("TF:").appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD").appendField(createGearSettingsButton('adx'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Average Directional Index - trend strength");
        this.indicatorName = 'adx';
        this.indicatorParams = getDefaultParams('adx');
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

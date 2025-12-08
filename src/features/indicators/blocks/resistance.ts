import { TIMEFRAME_OPTIONS } from "./timeframes";
import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['ta_resistance'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Resistance Level");
        this.appendDummyInput()
            .appendField("TF:")
            .appendField(new Blockly.FieldDropdown(TIMEFRAME_OPTIONS), "PERIOD")
            .appendField(createGearSettingsButton('ta_resistance'));
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Returns the last identified resistance level using pivot point analysis");
        this.indicatorName = 'ta_resistance';
        this.indicatorParams = getDefaultParams('ta_resistance');
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
    }
};

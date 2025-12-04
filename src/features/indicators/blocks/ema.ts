import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['ta_ema'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("EMA")
            .appendField(new Blockly.FieldTextInput("EMA"), "NAME")
            .appendField("TF:").appendField(new Blockly.FieldTextInput("60"), "PERIOD").appendField(createGearSettingsButton('ema'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Exponential Moving Average");
        this.indicatorName = 'ema';
        this.indicatorParams = getDefaultParams('ema');
    },
    mutationToDom: function() {
        const container = Blockly.utils.xml.createElement('mutation');
        if (this.indicatorParams) {
            Object.keys(this.indicatorParams).forEach(key => {
                container.setAttribute(key, String(this.indicatorParams[key]));
            });
        }
        return container;
    },
    domToMutation: function(xmlElement: Element) {
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


import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['adxWilder'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("ADX Wilder")
            .appendField(new Blockly.FieldTextInput("ADX Wilder"), "NAME")
            .appendField(createGearSettingsButton('adxWilder'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("ADX by Welles Wilder");
        this.indicatorName = 'adxWilder';
        this.indicatorParams = getDefaultParams('adxWilder');
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
    }
};


import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['ta_lowest'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Lowest Low");
        this.appendDummyInput()
            .appendField("TF:")
            .appendField(new Blockly.FieldTextInput("60"), "PERIOD")
            .appendField(createGearSettingsButton('ta_lowest'));
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Returns the lowest low value over the specified number of bars");
        this.indicatorName = 'ta_lowest';
        this.indicatorParams = getDefaultParams('ta_lowest');
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

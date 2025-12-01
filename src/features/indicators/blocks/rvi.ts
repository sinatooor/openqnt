import * as Blockly from 'blockly';
import { createGearSettingsButton } from '@/lib/indicatorUtils';
import { getIndicatorConfig, getDefaultParams } from '@/lib/indicatorConfigs';

Blockly.Blocks['rvi'] = {
    init: function () {
        const config = getIndicatorConfig('rvi');
        this.appendDummyInput()
            .appendField("RVI")
            .appendField(new Blockly.FieldTextInput("RVI"), "NAME")
            .appendField(new Blockly.FieldDropdown(
                config?.components?.map(c => [c.label, c.value]) || []
            ), "COMPONENT")
            .appendField(createGearSettingsButton('rvi'));
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Relative Vigor Index");
        this.indicatorName = 'rvi';
        this.indicatorParams = getDefaultParams('rvi');
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


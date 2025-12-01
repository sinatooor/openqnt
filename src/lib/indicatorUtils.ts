import * as Blockly from 'blockly';
import { IndicatorConfig, getIndicatorConfig, getDefaultParams } from './indicatorConfigs';

/**
 * Creates a settings button field for a Blockly block
 * Uses FieldImage with white filled gear icon
 */
export function createGearSettingsButton(indicatorName: string): Blockly.FieldImage {
  // White filled gear icon SVG
  const gearSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

  const field = new Blockly.FieldImage(gearSvg, 14, 14, '⚙️', () => {
    const block = field.getSourceBlock();
    if (block && (window as any).openIndicatorSettings) {
      (window as any).openIndicatorSettings(block.id, indicatorName);
    }
  });
  return field;
}

/**
 * Helper to create a block with settings button and optional component dropdown
 */
export function createIndicatorBlock(
  blockType: string,
  indicatorName: string,
  displayName: string,
  hasComponents: boolean = false
): void {
  const config = getIndicatorConfig(indicatorName);

  Blockly.Blocks[blockType] = {
    init: function () {
      const block = this;

      // Add component dropdown if needed
      if (hasComponents && config?.components) {
        const componentOptions = config.components.map(c => [c.label, c.value] as [string, string]);
        this.appendDummyInput()
          .appendField(displayName)
          .appendField(new Blockly.FieldDropdown(componentOptions), 'COMPONENT');
      } else {
        this.appendDummyInput()
          .appendField(displayName);
      }

      // Add settings button
      this.appendDummyInput()
        .appendField(createGearSettingsButton(indicatorName));

      this.setOutput(true, 'TAValue');
      this.setStyle('ta_blocks');
      this.setTooltip(`${displayName} - Click gear icon to configure`);

      // Store indicator name and default params
      this.indicatorName = indicatorName;
      this.indicatorParams = config ? getDefaultParams(indicatorName) : {};
    },

    // Mutation to store custom parameters
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
}

// getDefaultParams is now exported from indicatorConfigs


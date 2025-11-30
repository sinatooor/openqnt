import * as Blockly from 'blockly';
import { IndicatorConfig, getIndicatorConfig, getDefaultParams } from './indicatorConfigs';

/**
 * Creates a settings button field for a Blockly block
 * Uses FieldImage with white filled gear icon
 */
export function createGearSettingsButton(indicatorName: string): Blockly.FieldImage {
  // White filled gear icon SVG
  const gearSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.15-.36.15-.76 0-1.12l1.1-2.56c.22-.51.07-1.09-.36-1.47l-2.13-1.85c-.34-.3-.8-.38-1.21-.2l-2.88 1.19c-.5-.48-1.07-.87-1.7-1.15L12.5 2.5c-.06-.55-.5-.99-1.05-1.05L8.5 1.5c-.55.06-.99.5-1.05 1.05l-.4 3.27c-.63.28-1.2.67-1.7 1.15l-2.88-1.19c-.41-.18-.87-.1-1.21.2L1.83 7.82c-.43.38-.58.96-.36 1.47l1.1 2.56c.15.36.15.76 0 1.12l-1.1 2.56c-.22.51-.07 1.09.36 1.47l2.13 1.85c.34.3.8.38 1.21.2l2.88-1.19c.5.48 1.07.87 1.7 1.15l.4 3.27c.06.55.5.99 1.05 1.05L11.5 22.5c.55-.06.99-.5 1.05-1.05l.4-3.27c.63-.28 1.2-.67 1.7-1.15l2.88 1.19c.41.18.87.1 1.21-.2l2.13-1.85c.43-.38.58-.96.36-1.47l-1.1-2.56Z"/></svg>';
  
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
    init: function() {
      const block = this;
      
      // Add component dropdown if needed
      if (hasComponents && config?.components) {
        const componentOptions = config.components.map(c => [c.label, c.value]);
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
}

// getDefaultParams is now exported from indicatorConfigs


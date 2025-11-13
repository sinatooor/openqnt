import * as Blockly from 'blockly';
import { taIndicators, supportResistanceIndicators } from '@/lib/taIndicators';

// Support and Resistance blocks with timeframe
Blockly.Blocks['ta_support'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Nearest support level")
      .appendField(new Blockly.FieldDropdown([
        ["1m", "1m"],
        ["5m", "5m"],
        ["15m", "15m"],
        ["30m", "30m"],
        ["1h", "1h"],
        ["4h", "4h"],
        ["1d", "1d"],
        ["1w", "1w"]
      ]), "TIMEFRAME");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Nearest support level on selected timeframe");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['ta_resistance'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Nearest resistance level")
      .appendField(new Blockly.FieldDropdown([
        ["1m", "1m"],
        ["5m", "5m"],
        ["15m", "15m"],
        ["30m", "30m"],
        ["1h", "1h"],
        ["4h", "4h"],
        ["1d", "1d"],
        ["1w", "1w"]
      ]), "TIMEFRAME");
    this.setOutput(true, "TAValue");
    this.setStyle('ta_blocks');
    this.setTooltip("Nearest resistance level on selected timeframe");
    this.setHelpUrl("");
  }
};

// Dynamically create blocks for all pandas-ta indicators
taIndicators.forEach(indicator => {
  const blockType = `ta_${indicator.id}`;
  
  Blockly.Blocks[blockType] = {
    init: function(this: any) {
      // Store default parameters
      this.params = indicator.parameters.reduce((acc, param) => {
        acc[param.name] = param.default;
        return acc;
      }, {} as Record<string, any>);
      
      // Create main field with settings button
      const mainInput = this.appendDummyInput('MAIN');
      mainInput.appendField(indicator.name);
      
      // Add settings gear icon if there are parameters - clickable
      if (indicator.parameters.length > 0) {
        const settingsImage = new Blockly.FieldImage(
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDIwYTggOCAwIDEgMCAwLTE2IDggOCAwIDAgMCAwIDE2WiIvPjxwYXRoIGQ9Ik0xMiAxNmguMDEiLz48cGF0aCBkPSJNMTIgOHY0Ii8+PC9zdmc+',
          15,
          15,
          "Settings"
        );
        
        // Make settings icon clickable
        (settingsImage as any).setOnClickHandler(() => {
          const block = this as any;
          const indicator = taIndicators.find(ind => ind.id === block.type.replace('ta_', ''));
          if (!indicator) return;
          
          // Create configuration dialog
          let configText = `Configure ${indicator.name}:\n\n`;
          indicator.parameters.forEach(param => {
            const currentValue = block.params[param.name] || param.default;
            configText += `${param.description || param.name}: ${currentValue}\n`;
          });
          
          const newValues: Record<string, number> = {};
          indicator.parameters.forEach(param => {
            const currentValue = block.params[param.name] || param.default;
            const input = prompt(
              `${param.description || param.name}\nRange: ${param.min} - ${param.max}\nCurrent: ${currentValue}`,
              String(currentValue)
            );
            
            if (input !== null) {
              const value = parseFloat(input);
              if (!isNaN(value) && value >= param.min! && value <= param.max!) {
                newValues[param.name] = value;
              } else {
                newValues[param.name] = currentValue;
              }
            } else {
              newValues[param.name] = currentValue;
            }
          });
          
          block.params = newValues;
          block.workspace?.render();
        });
        
        mainInput.appendField(settingsImage);
      }
      
      this.setOutput(true, "TAValue");
      this.setStyle('ta_blocks');
      this.setTooltip(indicator.description);
      this.setHelpUrl("");
    },
    
    // Mutation methods for saving/loading parameters
    mutationToDom: function(this: any) {
      const container = Blockly.utils.xml.createElement('mutation');
      if (this.params) {
        Object.entries(this.params).forEach(([key, value]) => {
          container.setAttribute(key, String(value));
        });
      }
      return container;
    },
    
    domToMutation: function(this: any, xmlElement: Element) {
      this.params = this.params || {};
      const attributes = xmlElement.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        this.params[attr.name] = parseFloat(attr.value);
      }
    }
  };
});

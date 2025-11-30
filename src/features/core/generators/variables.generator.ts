import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Variable generators
javascriptGenerator.forBlock['variables_set'] = function(block: Blockly.Block) {
  const varName = block.getFieldValue('VAR');
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || '0';
  const code = `${varName} = ${value};\n`;
  return code;
};

javascriptGenerator.forBlock['variables_get'] = function(block: Blockly.Block) {
  const varName = block.getFieldValue('VAR');
  const code = varName;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['variables_change'] = function(block: Blockly.Block) {
  const varName = block.getFieldValue('VAR');
  const delta = javascriptGenerator.valueToCode(block, 'DELTA', Order.ADDITION) || '0';
  const code = `${varName} += ${delta};\n`;
  return code;
};

// Function generators
javascriptGenerator.forBlock['function_define'] = function(block: Blockly.Block) {
  const funcName = block.getFieldValue('NAME');
  const stack = javascriptGenerator.statementToCode(block, 'STACK');
  const code = `function ${funcName}() {\n${stack}}\n`;
  return code;
};

javascriptGenerator.forBlock['function_call'] = function(block: Blockly.Block) {
  const funcName = block.getFieldValue('NAME');
  const code = `${funcName}();\n`;
  return code;
};

javascriptGenerator.forBlock['function_return'] = function(block: Blockly.Block) {
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'null';
  const code = `return ${value};\n`;
  return code;
};

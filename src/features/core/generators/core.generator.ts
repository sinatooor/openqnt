import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Environment blocks
javascriptGenerator.forBlock['environment_price'] = function () {
  const code = 'getPrice()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_volume'] = function () {
  const code = 'getVolume()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_time'] = function () {
  const code = 'getTime()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_spread'] = function () {
  const code = 'getSpread()';
  return [code, Order.ATOMIC];
};

// Operator blocks - Comparison
javascriptGenerator.forBlock['operator_equals'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.EQUALITY) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.EQUALITY) || '0';
  const code = `${left} === ${right}`;
  return [code, Order.EQUALITY];
};

javascriptGenerator.forBlock['operator_greater'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} > ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_less'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} < ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_greater_equals'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} >= ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_less_equals'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} <= ${right}`;
  return [code, Order.RELATIONAL];
};

// Operator blocks - Math
javascriptGenerator.forBlock['operator_add'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.ADDITION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.ADDITION) || '0';
  const code = `${left} + ${right}`;
  return [code, Order.ADDITION];
};

javascriptGenerator.forBlock['operator_subtract'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.SUBTRACTION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.SUBTRACTION) || '0';
  const code = `${left} - ${right}`;
  return [code, Order.SUBTRACTION];
};

javascriptGenerator.forBlock['operator_multiply'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.MULTIPLICATION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.MULTIPLICATION) || '0';
  const code = `${left} * ${right}`;
  return [code, Order.MULTIPLICATION];
};

javascriptGenerator.forBlock['operator_divide'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.DIVISION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.DIVISION) || '1';
  const code = `${left} / ${right}`;
  return [code, Order.DIVISION];
};

// Operator blocks - Logic
javascriptGenerator.forBlock['operator_and'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_AND) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_AND) || 'false';
  const code = `${left} && ${right}`;
  return [code, Order.LOGICAL_AND];
};

javascriptGenerator.forBlock['operator_or'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_OR) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_OR) || 'false';
  const code = `${left} || ${right}`;
  return [code, Order.LOGICAL_OR];
};

javascriptGenerator.forBlock['operator_not'] = function (block: Blockly.Block) {
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.LOGICAL_NOT) || 'false';
  const code = `!${value}`;
  return [code, Order.LOGICAL_NOT];
};

javascriptGenerator.forBlock['operator_not_equals'] = function (block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.EQUALITY) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.EQUALITY) || '0';
  const code = `${left} !== ${right}`;
  return [code, Order.EQUALITY];
};

javascriptGenerator.forBlock['operator_advanced_math'] = function (block: Blockly.Block) {
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  const func = block.getFieldValue('FUNCTION');
  let code = '';

  switch (func) {
    case 'abs':
    case 'sqrt':
    case 'sin':
    case 'cos':
    case 'tan':
    case 'exp':
    case 'round':
    case 'floor':
    case 'ceil':
      code = `Math.${func}(${value})`;
      break;
    case 'log':
      code = `Math.log10(${value})`;
      break;
    case 'ln':
      code = `Math.log(${value})`;
      break;
    default:
      code = value;
  }

  return [code, Order.FUNCTION_CALL];
};

// Control blocks
javascriptGenerator.forBlock['control_if'] = function (block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `if (${condition}) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_repeat'] = function (block: Blockly.Block) {
  const times = javascriptGenerator.valueToCode(block, 'TIMES', Order.NONE) || '1';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `for (let i = 0; i < ${times}; i++) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_wait'] = function (block: Blockly.Block) {
  const seconds = javascriptGenerator.valueToCode(block, 'SECONDS', Order.NONE) || '1';
  const code = `await wait(${seconds});\n`;
  return code;
};

javascriptGenerator.forBlock['control_forever'] = function (block: Blockly.Block) {
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `while (true) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_repeat_until'] = function (block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `while (!(${condition})) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_if_else'] = function (block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const elseCode = javascriptGenerator.statementToCode(block, 'ELSE');
  const code = `if (${condition}) {\n${doCode}} else {\n${elseCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_wait_until'] = function (block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const code = `while (!(${condition})) { await wait(0.1); }\n`;
  return code;
};

javascriptGenerator.forBlock['control_stop'] = function () {
  const code = `return;\n`;
  return code;
};

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Environment blocks
javascriptGenerator.forBlock['environment_price'] = function() {
  const code = 'getPrice()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_volume'] = function() {
  const code = 'getVolume()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_time'] = function() {
  const code = 'getTime()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['environment_spread'] = function() {
  const code = 'getSpread()';
  return [code, Order.ATOMIC];
};

// Operator blocks - Comparison
javascriptGenerator.forBlock['operator_equals'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.EQUALITY) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.EQUALITY) || '0';
  const code = `${left} === ${right}`;
  return [code, Order.EQUALITY];
};

javascriptGenerator.forBlock['operator_greater'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} > ${right}`;
  return [code, Order.RELATIONAL];
};

javascriptGenerator.forBlock['operator_less'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.RELATIONAL) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.RELATIONAL) || '0';
  const code = `${left} < ${right}`;
  return [code, Order.RELATIONAL];
};

// Operator blocks - Math
javascriptGenerator.forBlock['operator_add'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.ADDITION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.ADDITION) || '0';
  const code = `${left} + ${right}`;
  return [code, Order.ADDITION];
};

javascriptGenerator.forBlock['operator_subtract'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.SUBTRACTION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.SUBTRACTION) || '0';
  const code = `${left} - ${right}`;
  return [code, Order.SUBTRACTION];
};

javascriptGenerator.forBlock['operator_multiply'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.MULTIPLICATION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.MULTIPLICATION) || '0';
  const code = `${left} * ${right}`;
  return [code, Order.MULTIPLICATION];
};

javascriptGenerator.forBlock['operator_divide'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.DIVISION) || '0';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.DIVISION) || '1';
  const code = `${left} / ${right}`;
  return [code, Order.DIVISION];
};

// Operator blocks - Logic
javascriptGenerator.forBlock['operator_and'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_AND) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_AND) || 'false';
  const code = `${left} && ${right}`;
  return [code, Order.LOGICAL_AND];
};

javascriptGenerator.forBlock['operator_or'] = function(block: Blockly.Block) {
  const left = javascriptGenerator.valueToCode(block, 'LEFT', Order.LOGICAL_OR) || 'false';
  const right = javascriptGenerator.valueToCode(block, 'RIGHT', Order.LOGICAL_OR) || 'false';
  const code = `${left} || ${right}`;
  return [code, Order.LOGICAL_OR];
};

// Control blocks
javascriptGenerator.forBlock['control_if'] = function(block: Blockly.Block) {
  const condition = javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `if (${condition}) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_repeat'] = function(block: Blockly.Block) {
  const times = javascriptGenerator.valueToCode(block, 'TIMES', Order.NONE) || '1';
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `for (let i = 0; i < ${times}; i++) {\n${doCode}}\n`;
  return code;
};

javascriptGenerator.forBlock['control_wait'] = function(block: Blockly.Block) {
  const seconds = javascriptGenerator.valueToCode(block, 'SECONDS', Order.NONE) || '1';
  const code = `await wait(${seconds});\n`;
  return code;
};

javascriptGenerator.forBlock['control_forever'] = function(block: Blockly.Block) {
  const doCode = javascriptGenerator.statementToCode(block, 'DO');
  const code = `while (true) {\n${doCode}}\n`;
  return code;
};

// Trade blocks
javascriptGenerator.forBlock['trade_buy'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '0';
  const code = `buy(${amount});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_sell'] = function(block: Blockly.Block) {
  const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '0';
  const code = `sell(${amount});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_stop_loss'] = function(block: Blockly.Block) {
  const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '0';
  const code = `setStopLoss(${percent});\n`;
  return code;
};

javascriptGenerator.forBlock['trade_take_profit'] = function(block: Blockly.Block) {
  const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '0';
  const code = `setTakeProfit(${percent});\n`;
  return code;
};

// TA blocks
javascriptGenerator.forBlock['ta_sma'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `sma(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ema'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `ema(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_rsi'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
  const code = `rsi(${period})`;
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_macd'] = function() {
  const code = 'macd()';
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_bb'] = function(block: Blockly.Block) {
  const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
  const code = `bollingerBands(${period})`;
  return [code, Order.ATOMIC];
};

// Export function to generate code from workspace
export function generateCode(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace);
}

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['ta_stochastic'] = function (block: Blockly.Block) {
    const kPeriod = javascriptGenerator.valueToCode(block, 'K_PERIOD', Order.NONE) || '14';
    const dPeriod = javascriptGenerator.valueToCode(block, 'D_PERIOD', Order.NONE) || '3';
    const code = `stochastic(${kPeriod}, ${dPeriod})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_adx'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
    const code = `adx(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_cci'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
    const code = `cci(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_williams_r'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
    const code = `williamsR(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_obv'] = function () {
    const code = 'obv()';
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_mfi'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
    const code = `mfi(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_sar'] = function (block: Blockly.Block) {
    const acceleration = javascriptGenerator.valueToCode(block, 'ACCELERATION', Order.NONE) || '0.02';
    const max = javascriptGenerator.valueToCode(block, 'MAX', Order.NONE) || '0.2';
    const code = `parabolicSAR(${acceleration}, ${max})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ichimoku'] = function () {
    const code = 'ichimoku()';
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_vp'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '100';
    const code = `volumeProfile(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_keltner'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
    const code = `keltner(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_dmi'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
    const code = `dmi(${period})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_supertrend'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '10';
    const multiplier = javascriptGenerator.valueToCode(block, 'MULTIPLIER', Order.NONE) || '3';
    const code = `supertrend(${period}, ${multiplier})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_pivot'] = function () {
    const code = 'pivotPoints()';
    return [code, Order.ATOMIC];
};

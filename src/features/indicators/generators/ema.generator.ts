import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['ta_ema'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
    const code = `ema(${period})`;
    return [code, Order.ATOMIC];
};

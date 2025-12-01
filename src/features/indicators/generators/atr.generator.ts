import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['ta_atr'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '14';
    const code = `atr(${period})`;
    return [code, Order.ATOMIC];
};

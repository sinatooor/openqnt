import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['ta_bb'] = function (block: Blockly.Block) {
    const period = javascriptGenerator.valueToCode(block, 'PERIOD', Order.NONE) || '20';
    const code = `bollingerBands(${period})`;
    return [code, Order.ATOMIC];
};

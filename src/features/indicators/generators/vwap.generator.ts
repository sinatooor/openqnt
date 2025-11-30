import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['ta_vwap'] = function () {
    const code = 'vwap()';
    return [code, Order.ATOMIC];
};

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

/**
 * Generator for MACD block with component selector
 */
javascriptGenerator.forBlock['macd_value'] = function (block: Blockly.Block) {
    const component = block.getFieldValue('COMPONENT');
    // TODO: Get config from global state when settings are implemented
    const code = `macd().${component}`;
    return [code, Order.MEMBER];
};

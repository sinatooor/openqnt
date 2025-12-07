import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Trade Generators
javascriptGenerator.forBlock['trade_order'] = function (block: Blockly.Block) {
    const direction = block.getFieldValue('DIRECTION');
    const tradeId = block.getFieldValue('TRADE_ID');
    const size = block.getFieldValue('SIZE') || '100';
    const sizeType = block.getFieldValue('SIZE_TYPE');

    const orderType = block.getFieldValue('ORDER_TYPE');
    const limitPrice = orderType === 'limit'
        ? javascriptGenerator.valueToCode(block, 'LIMIT_PRICE', Order.NONE) || '0'
        : 'null';
    const code = `placeOrder("${tradeId}", "${direction}", ${size}, "${sizeType}", "${orderType}", ${limitPrice});\n`;
    return code;
};

javascriptGenerator.forBlock['trade_stop_loss'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const price = javascriptGenerator.valueToCode(block, 'PRICE', Order.NONE) || '0';
    const closeType = block.getFieldValue('CLOSE_TYPE');
    const percent = closeType === 'partial' ? block.getFieldValue('PERCENT_VALUE') : '100';
    const code = `setStopLoss("${tradeId}", ${price}, ${percent});\n`;
    return code;
};

javascriptGenerator.forBlock['trade_take_profit'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const price = javascriptGenerator.valueToCode(block, 'PRICE', Order.NONE) || '0';
    const closeType = block.getFieldValue('CLOSE_TYPE');
    const percent = closeType === 'partial' ? block.getFieldValue('PERCENT_VALUE') : '100';
    const code = `setTakeProfit("${tradeId}", ${price}, ${percent});\n`;
    return code;
};

javascriptGenerator.forBlock['trade_close'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '100';
    const code = `closeTrade("${tradeId}", ${percent});\n`;
    return code;
};

javascriptGenerator.forBlock['trade_pnl_of'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const code = `getPnL("${tradeId}")`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['trade_entry_price'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const code = `getEntryPrice("${tradeId}")`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['trade_position_size'] = function (block: Blockly.Block) {
    const tradeId = block.getFieldValue('TRADE_ID');
    const code = `getPositionSize("${tradeId}")`;
    return [code, Order.ATOMIC];
};

// Risk Generators
javascriptGenerator.forBlock['risk_fixed_amount'] = function (block: Blockly.Block) {
    const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '100';
    const code = `${amount}`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['risk_trailing_stop'] = function (block: Blockly.Block) {
    const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '2';
    const code = `setTrailingStop(${percent});\n`;
    return code;
};

javascriptGenerator.forBlock['risk_scale_in'] = function (block: Blockly.Block) {
    const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '50';
    const intervals = javascriptGenerator.valueToCode(block, 'INTERVALS', Order.NONE) || '3';
    const code = `scaleIn(${amount}, ${intervals});\n`;
    return code;
};

javascriptGenerator.forBlock['risk_scale_out'] = function (block: Blockly.Block) {
    const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '50';
    const intervals = javascriptGenerator.valueToCode(block, 'INTERVALS', Order.NONE) || '3';
    const code = `scaleOut(${amount}, ${intervals});\n`;
    return code;
};

javascriptGenerator.forBlock['risk_max_drawdown'] = function (block: Blockly.Block) {
    const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '20';
    const code = `setMaxDrawdown(${percent});\n`;
    return code;
};

javascriptGenerator.forBlock['risk_daily_loss_limit'] = function (block: Blockly.Block) {
    const amount = javascriptGenerator.valueToCode(block, 'AMOUNT', Order.NONE) || '500';
    const code = `setDailyLossLimit(${amount});\n`;
    return code;
};

javascriptGenerator.forBlock['risk_position_percent'] = function (block: Blockly.Block) {
    const percent = javascriptGenerator.valueToCode(block, 'PERCENT', Order.NONE) || '10';
    const code = `positionPercent(${percent})`;
    return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['risk_kelly_criterion'] = function (block: Blockly.Block) {
    const winRate = javascriptGenerator.valueToCode(block, 'WIN_RATE', Order.NONE) || '0.6';
    const winLossRatio = javascriptGenerator.valueToCode(block, 'WIN_LOSS_RATIO', Order.NONE) || '2';
    const code = `kellyCriterion(${winRate}, ${winLossRatio})`;
    return [code, Order.ATOMIC];
};

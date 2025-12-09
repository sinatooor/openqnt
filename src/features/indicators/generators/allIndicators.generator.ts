import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { getIndicatorConfig } from '@/lib/indicatorConfigs';

/**
 * Helper to get params from block's indicatorParams
 */
function getParams(block: any): Record<string, number> {
    return block.indicatorParams || {};
}

/**
 * Helper to get param value or default
 */
function getParam(block: any, paramName: string, defaultValue: number): string {
    const params = getParams(block);
    const value = params[paramName] ?? defaultValue;
    return String(value);
}

/**
 * Helper to get component from block
 */
function getComponent(block: any): string {
    const component = block.getFieldValue('COMPONENT');
    return component ? `, '${component}'` : '';
}

// Oscillators
javascriptGenerator.forBlock['ac'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    return [`acceleratorOscillator(${period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ao'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    return [`awesomeOscillator(${period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ad'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const applied_volume = getParam(block, 'applied_volume', 0);
    return [`accumulationDistribution(${period}, ${applied_volume})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_cci'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`cci(${period}, ${ma_period}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['chaikin'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const fastMA = getParam(block, 'fastMA', 3);
    const slowMA = getParam(block, 'slowMA', 10);
    const method = getParam(block, 'method', 1);
    const applied_volume = getParam(block, 'applied_volume', 0);
    return [`chaikinOscillator(${period}, ${fastMA}, ${slowMA}, ${method}, ${applied_volume})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['demarker'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    return [`deMarker(${period}, ${ma_period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['force'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 13);
    const method = getParam(block, 'method', 0);
    const applied_volume = getParam(block, 'applied_volume', 0);
    return [`forceIndex(${period}, ${ma_period}, ${method}, ${applied_volume})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['momentum'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`momentum(${period}, ${ma_period}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_mfi'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const applied_volume = getParam(block, 'applied_volume', 0);
    return [`mfi(${period}, ${ma_period}, ${applied_volume})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['osma'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const fastEMA = getParam(block, 'fastEMA', 12);
    const slowEMA = getParam(block, 'slowEMA', 26);
    const signalSMA = getParam(block, 'signalSMA', 9);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`osma(${period}, ${fastEMA}, ${slowEMA}, ${signalSMA}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_rsi'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`rsi(${period}, ${ma_period}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['rvi'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 10);
    const component = getComponent(block);
    return [`rvi(${period}, ${ma_period}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_stochastic'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const kPeriod = getParam(block, 'kPeriod', 5);
    const dPeriod = getParam(block, 'dPeriod', 3);
    const slowing = getParam(block, 'slowing', 3);
    const method = getParam(block, 'method', 0);
    const price = getParam(block, 'price', 0);
    const component = getComponent(block);
    return [`stochastic(${period}, ${kPeriod}, ${dPeriod}, ${slowing}, ${method}, ${price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_williams_r'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    return [`williamsR(${period}, ${ma_period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['trix'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`trix(${period}, ${ma_period}, ${applied_price})`, Order.ATOMIC];
};

// Moving Averages
javascriptGenerator.forBlock['ta_sma'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`sma(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ema'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`ema(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_smma'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`smma(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_lwma'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`lwma(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['dema'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`dema(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['tema'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`tema(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['frama'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`frama(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['vidya'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 9);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`vidya(${period}, ${ma_period}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ama'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 9);
    const fastPeriod = getParam(block, 'fastPeriod', 2);
    const slowPeriod = getParam(block, 'slowPeriod', 30);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`ama(${period}, ${ma_period}, ${fastPeriod}, ${slowPeriod}, ${shift}, ${applied_price})`, Order.ATOMIC];
};

// Bands & Channels
javascriptGenerator.forBlock['ta_bb'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 20);
    const deviation = getParam(block, 'deviation', 2.0);
    const shift = getParam(block, 'shift', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`bollingerBands(${period}, ${ma_period}, ${deviation}, ${shift}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['envelopes'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const deviation = getParam(block, 'deviation', 0.1);
    const shift = getParam(block, 'shift', 0);
    const method = getParam(block, 'method', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`envelopes(${period}, ${ma_period}, ${deviation}, ${shift}, ${method}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['donchian'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 20);
    const shift = getParam(block, 'shift', 0);
    const component = getComponent(block);
    return [`donchianChannels(${period}, ${ma_period}, ${shift}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_keltner'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 20);
    const deviation = getParam(block, 'deviation', 2.0);
    const shift = getParam(block, 'shift', 0);
    const method = getParam(block, 'method', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`keltnerChannels(${period}, ${ma_period}, ${deviation}, ${shift}, ${method}, ${applied_price}${component})`, Order.ATOMIC];
};

// Complex Indicators
javascriptGenerator.forBlock['macd_value'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const fastEMA = getParam(block, 'fastEMA', 12);
    const slowEMA = getParam(block, 'slowEMA', 26);
    const signalSMA = getParam(block, 'signalSMA', 9);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`macd(${period}, ${fastEMA}, ${slowEMA}, ${signalSMA}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_ichimoku'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const tenkanSen = getParam(block, 'tenkanSen', 9);
    const kijunSen = getParam(block, 'kijunSen', 26);
    const senkouSpanB = getParam(block, 'senkouSpanB', 52);
    const component = getComponent(block);
    return [`ichimoku(${period}, ${tenkanSen}, ${kijunSen}, ${senkouSpanB}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['alligator'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const jawPeriod = getParam(block, 'jawPeriod', 13);
    const jawShift = getParam(block, 'jawShift', 8);
    const teethPeriod = getParam(block, 'teethPeriod', 8);
    const teethShift = getParam(block, 'teethShift', 5);
    const lipsPeriod = getParam(block, 'lipsPeriod', 5);
    const lipsShift = getParam(block, 'lipsShift', 3);
    const method = getParam(block, 'method', 2);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`alligator(${period}, ${jawPeriod}, ${jawShift}, ${teethPeriod}, ${teethShift}, ${lipsPeriod}, ${lipsShift}, ${method}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['gator'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const jawPeriod = getParam(block, 'jawPeriod', 13);
    const jawShift = getParam(block, 'jawShift', 8);
    const teethPeriod = getParam(block, 'teethPeriod', 8);
    const teethShift = getParam(block, 'teethShift', 5);
    const lipsPeriod = getParam(block, 'lipsPeriod', 5);
    const lipsShift = getParam(block, 'lipsShift', 3);
    const method = getParam(block, 'method', 2);
    const applied_price = getParam(block, 'applied_price', 0);
    const component = getComponent(block);
    return [`gatorOscillator(${period}, ${jawPeriod}, ${jawShift}, ${teethPeriod}, ${teethShift}, ${lipsPeriod}, ${lipsShift}, ${method}, ${applied_price}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_dmi'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    const component = getComponent(block);
    return [`dmi(${period}, ${ma_period}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_adx'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    return [`adx(${period}, ${ma_period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['adxWilder'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    return [`adxWilder(${period}, ${ma_period})`, Order.ATOMIC];
};

// Volatility
javascriptGenerator.forBlock['ta_atr'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 14);
    return [`atr(${period}, ${ma_period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['stddev'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 20);
    const shift = getParam(block, 'shift', 0);
    const method = getParam(block, 'method', 0);
    const applied_price = getParam(block, 'applied_price', 0);
    return [`stdDev(${period}, ${ma_period}, ${shift}, ${method}, ${applied_price})`, Order.ATOMIC];
};


// Trend
javascriptGenerator.forBlock['ta_supertrend'] = function (block: any) {
    const period = getParam(block, 'period_value', 10);
    const multiplier = getParam(block, 'multiplier', 3);
    return [`superTrend(${period}, ${multiplier})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_sar'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const step = getParam(block, 'step', 0.02);
    const maximum = getParam(block, 'maximum', 0.2);
    return [`parabolicSAR(${period}, ${step}, ${maximum})`, Order.ATOMIC];
};


// Volume
javascriptGenerator.forBlock['ta_obv'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const applied_volume = getParam(block, 'applied_volume', 0);
    return [`obv(${period}, ${applied_volume})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['volumes'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const applied_volume = getParam(block, 'applied_volume', 0);
    const component = getComponent(block);
    return [`volumes(${period}, ${applied_volume}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['bwmfi'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const applied_volume = getParam(block, 'applied_volume', 0);
    const component = getComponent(block);
    return [`marketFacilitationIndex(${period}, ${applied_volume}${component})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['ta_vwap'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    return [`vwap(${period})`, Order.ATOMIC];
};


// Power Indicators
javascriptGenerator.forBlock['bearsPower'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 13);
    return [`bearsPower(${period}, ${ma_period})`, Order.ATOMIC];
};

javascriptGenerator.forBlock['bullsPower'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const ma_period = getParam(block, 'ma_period', 13);
    return [`bullsPower(${period}, ${ma_period})`, Order.ATOMIC];
};

// Other
javascriptGenerator.forBlock['fractals'] = function (block: any) {
    const period = getParam(block, 'period', 0);
    const component = getComponent(block);
    return [`fractals(${period}${component})`, Order.ATOMIC];
};



import * as Blockly from 'blockly';

Blockly.Blocks['ta_sma'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("SMA");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Simple Moving Average");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_ema'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("EMA");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Exponential Moving Average");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_rsi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("RSI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Relative Strength Index");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_macd'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("MACD");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Moving Average Convergence Divergence");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_bb'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("BB");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Bollinger Bands");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_vwap'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("VWAP");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Volume Weighted Average Price");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_atr'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("ATR");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Average True Range - volatility indicator");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_stochastic'] = {
    init: function () {
        this.appendValueInput("K_PERIOD")
            .setCheck("Number")
            .appendField("Stochastic K");
        this.appendValueInput("D_PERIOD")
            .setCheck("Number")
            .appendField("D");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Stochastic Oscillator");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_adx'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("ADX");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Average Directional Index - trend strength");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_cci'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("CCI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Commodity Channel Index");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_williams_r'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Williams %R");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Williams %R - momentum indicator");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_obv'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("OBV");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("On Balance Volume");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_mfi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("MFI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Money Flow Index");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_sar'] = {
    init: function () {
        this.appendValueInput("ACCELERATION")
            .setCheck("Number")
            .appendField("Parabolic SAR - Accel");
        this.appendValueInput("MAX")
            .setCheck("Number")
            .appendField("Max");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Parabolic Stop and Reverse");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_ichimoku'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Ichimoku Cloud");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Ichimoku Cloud indicator");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_vp'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Volume Profile");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Volume Profile");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_keltner'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("Keltner Channel");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Keltner Channels");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_dmi'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("DMI");
        this.appendDummyInput()
            .appendField("period");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Directional Movement Index");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_supertrend'] = {
    init: function () {
        this.appendValueInput("PERIOD")
            .setCheck("Number")
            .appendField("SuperTrend");
        this.appendValueInput("MULTIPLIER")
            .setCheck("Number")
            .appendField("Multiplier");
        this.setInputsInline(true);
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("SuperTrend indicator");
        this.setHelpUrl("");
    }
};

Blockly.Blocks['ta_pivot'] = {
    init: function () {
        this.appendDummyInput()
            .appendField("Pivot Points");
        this.setOutput(true, "TAValue");
        this.setStyle('ta_blocks');
        this.setTooltip("Pivot Points (support/resistance)");
        this.setHelpUrl("");
    }
};

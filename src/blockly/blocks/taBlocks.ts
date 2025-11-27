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
            .appendField("MACD")
            .appendField(new Blockly.FieldImage(
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiIHdpZHRoPSIyNHB4IiBoZWlnaHQ9IjI0cHgiPjxwYXRoIGQ9Ik0wIDBoMjR2MjRIMHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMTkuMTQgMTIuOTRjLjA0LS4zLjA2LS42MS4wNi0uOTQgMC0uMzItLjAyLS42NC0uMDctLjk0bDIuMDMtMS41OGMuMTgtLjE0LjIzLS40MS4xMi0uNjFsLTEuOTItMy4zMmMtLjEyLS4yMi0uMzctLjI5LS41OS0uMjJsLTIuMzkuOTZjLS41LS4zOC0xLjAzLS43LTEuNjItLjk0bC0uMzYtMi41NGMtLjA0LS4yNC0uMjQtLjQxLS40OC0uNDFoLTMuODRjLS4yNCAwLS40My4xNy0uNDcuNDFsLS4zNiAyLjU0Yy0uNTkuMjQtMS4xMy41Ny0xLjYyLjk0bC0yLjM5LS45NmMtLjIyLS4wOC0uNDcgMC0uNTkuMjJMMi43NCA4Ljg3Yy0uMTIuMjEtLjA4LjQ3LjEyLjYxbDIuMDMgMS41OGMtLjA1LjMwLS4wOS42My0uMDkuOTRzLjAyLjY0LjA3Ljk0bC0yLjAzIDEuNThjLS4xOC4xNC0uMjMuNDEtLjEyLjYxbDEuOTIgMy4zMmMuMTIuMjIuMzcuMjkuNTkuMjJsMi4zOS0uOTZjLjUuMzggMS4wMy43IDEuNjIuOTRsLjM2IDIuNTRjLjA1LjI0LjI0LjQxLjQ4LjQxaDMuODRjLjI0IDAgLjQ0LS4xNy40Ny0uNDFsLjM2LTIuNTRjLjU5LS4yNCAxLjEzLS41OCAxLjYyLS45NGwyLjM5Ljk2Yy4yMi4wOC40NyAwIC41OS0uMjJsMS45Mi0zLjMyYy4xMi0uMjIuMDctLjQ3LS4xMi0uNjFsLTIuMDEtMS41OHpNMTIgMTUuNmMtMS45OCAwLTMuNi0xLjYyLTMuNi0zLjZzMS42Mi0zLjYgMy42LTMuNiAzLjYgMS42MiAzLjYgMy42LTEuNjIgMy42LTMuNiAzLjZ6Ii8+PC9zdmc+",
                16, 16, "Settings",
                function (image: any) {
                    const block = (image as any).getSourceBlock();
                    const xml = block.getFieldValue('ADVANCED_LOGIC_XML');
                    if ((window as any).openAdvancedLogicModal) {
                        (window as any).openAdvancedLogicModal(block.id, 'ta_macd', xml);
                    }
                }
            ));
        this.appendDummyInput()
            .appendField(new Blockly.FieldTextInput(''), 'ADVANCED_LOGIC_XML')
            .setVisible(false);
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

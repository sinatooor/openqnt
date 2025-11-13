export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'trend' | 'reversal' | 'breakout' | 'scalping' | 'momentum';
  workspace: string; // XML representation of the Blockly workspace
}

export const strategyTemplates: StrategyTemplate[] = [
  {
    id: 'simple-ma-crossover',
    name: 'Simple MA Crossover',
    description: 'Buy when fast MA crosses above slow MA, sell when it crosses below. Classic trend-following strategy.',
    difficulty: 'beginner',
    category: 'trend',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="ta_sma">
                <value name="PERIOD">
                  <shadow type="math_number">
                    <field name="NUM">20</field>
                  </shadow>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <block type="ta_sma">
                <value name="PERIOD">
                  <shadow type="math_number">
                    <field name="NUM">50</field>
                  </shadow>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_position_percent">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">2</field>
                  </shadow>
                </value>
              </block>
            </value>
            <next>
              <block type="trade_stop_loss">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">2</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: 'rsi-oversold-reversal',
    name: 'RSI Oversold Reversal',
    description: 'Buy when RSI drops below 30 (oversold), sell when it rises above 70 (overbought). Mean reversion strategy.',
    difficulty: 'beginner',
    category: 'reversal',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_less">
            <value name="LEFT">
              <block type="ta_rsi">
                <value name="PERIOD">
                  <shadow type="math_number">
                    <field name="NUM">14</field>
                  </shadow>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <shadow type="math_number">
                <field name="NUM">30</field>
              </shadow>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_position_percent">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">3</field>
                  </shadow>
                </value>
              </block>
            </value>
            <next>
              <block type="trade_take_profit">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">5</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: 'bollinger-breakout',
    name: 'Bollinger Band Breakout',
    description: 'Enter trades when price breaks above upper band (bullish) or below lower band (bearish). Volatility breakout strategy.',
    difficulty: 'intermediate',
    category: 'breakout',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_greater">
            <value name="LEFT">
              <block type="environment_price"></block>
            </value>
            <value name="RIGHT">
              <block type="ta_bb">
                <value name="PERIOD">
                  <shadow type="math_number">
                    <field name="NUM">20</field>
                  </shadow>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_fixed_amount">
                <value name="AMOUNT">
                  <shadow type="math_number">
                    <field name="NUM">100</field>
                  </shadow>
                </value>
              </block>
            </value>
            <next>
              <block type="risk_trailing_stop">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">1.5</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: 'macd-momentum',
    name: 'MACD Momentum',
    description: 'Buy when MACD crosses above signal line, sell when it crosses below. Momentum-based strategy with trend confirmation.',
    difficulty: 'intermediate',
    category: 'momentum',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_and">
            <value name="LEFT">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_macd"></block>
                </value>
                <value name="RIGHT">
                  <shadow type="math_number">
                    <field name="NUM">0</field>
                  </shadow>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_adx">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">14</field>
                      </shadow>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <shadow type="math_number">
                    <field name="NUM">25</field>
                  </shadow>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_kelly_criterion">
                <value name="WIN_RATE">
                  <shadow type="math_number">
                    <field name="NUM">0.6</field>
                  </shadow>
                </value>
                <value name="WIN_LOSS_RATIO">
                  <shadow type="math_number">
                    <field name="NUM">1.5</field>
                  </shadow>
                </value>
              </block>
            </value>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: 'scalping-vwap',
    name: 'VWAP Scalping',
    description: 'Quick scalping strategy: buy when price is below VWAP with RSI oversold, tight stops. For high-frequency trading.',
    difficulty: 'advanced',
    category: 'scalping',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_and">
            <value name="LEFT">
              <block type="operator_less">
                <value name="LEFT">
                  <block type="environment_price"></block>
                </value>
                <value name="RIGHT">
                  <block type="ta_vwap"></block>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <block type="operator_less">
                <value name="LEFT">
                  <block type="ta_rsi">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">7</field>
                      </shadow>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <shadow type="math_number">
                    <field name="NUM">40</field>
                  </shadow>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_fixed_amount">
                <value name="AMOUNT">
                  <shadow type="math_number">
                    <field name="NUM">50</field>
                  </shadow>
                </value>
              </block>
            </value>
            <next>
              <block type="trade_stop_loss">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">0.5</field>
                  </shadow>
                </value>
                <next>
                  <block type="trade_take_profit">
                    <value name="PERCENT">
                      <shadow type="math_number">
                        <field name="NUM">1</field>
                      </shadow>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: 'triple-ema-trend',
    name: 'Triple EMA Trend',
    description: 'Advanced trend following with three EMAs. Enter when fast > medium > slow (aligned trend). Strong trend filter.',
    difficulty: 'advanced',
    category: 'trend',
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_if" x="50" y="50">
        <value name="CONDITION">
          <block type="operator_and">
            <value name="LEFT">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_ema">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">9</field>
                      </shadow>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="ta_ema">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">21</field>
                      </shadow>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <value name="RIGHT">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_ema">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">21</field>
                      </shadow>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="ta_ema">
                    <value name="PERIOD">
                      <shadow type="math_number">
                        <field name="NUM">55</field>
                      </shadow>
                    </value>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO">
          <block type="trade_buy">
            <value name="AMOUNT">
              <block type="risk_position_percent">
                <value name="PERCENT">
                  <shadow type="math_number">
                    <field name="NUM">4</field>
                  </shadow>
                </value>
              </block>
            </value>
            <next>
              <block type="risk_scale_out">
                <value name="AMOUNT">
                  <shadow type="math_number">
                    <field name="NUM">100</field>
                  </shadow>
                </value>
                <value name="INTERVALS">
                  <shadow type="math_number">
                    <field name="NUM">3</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </statement>
      </block>
    </xml>`,
  },
];

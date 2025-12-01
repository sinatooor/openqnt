export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "trend" | "reversal" | "breakout" | "scalping" | "momentum";
  workspace: string; // XML representation of the Blockly workspace
}

export const strategyTemplates: StrategyTemplate[] = [
  {
    id: "simple-ma-crossover",
    name: "Simple MA Crossover",
    description:
      "Buy when fast MA crosses above slow MA, sell when it crosses below. Classic trend-following strategy.",
    difficulty: "beginner",
    category: "trend",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="ta_sma">
                    <mutation period="20" ma_period="14" shift="0" applied_price="0"></mutation>
                    <field name="NAME">SMA</field>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="ta_sma">
                    <mutation period="50" ma_period="14" shift="0" applied_price="0"></mutation>
                    <field name="NAME">SMA</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO">
              <block type="trade_order">
                <field name="TRADE_ID">ma_crossover_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">2</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">percent</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_stop_loss">
                    <field name="TRADE_ID">ma_crossover_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="environment_price"></block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">0.01</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="TRADE_ID">ma_crossover_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="environment_price"></block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">0.02</field>
                                  </shadow>
                                </value>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: "rsi-oversold-reversal",
    name: "RSI Oversold Reversal",
    description:
      "Buy when RSI drops below 30 (oversold), sell when it rises above 70 (overbought). Mean reversion strategy.",
    difficulty: "beginner",
    category: "reversal",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_less">
                <value name="LEFT">
                  <block type="ta_rsi">
                    <mutation period="14" ma_period="14" applied_price="0"></mutation>
                    <field name="NAME">RSI</field>
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
              <block type="trade_order">
                <field name="TRADE_ID">rsi_reversal_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">3</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">percent</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_take_profit">
                    <field name="TRADE_ID">rsi_reversal_trade</field>
                    <value name="PRICE">
                      <block type="operator_add">
                        <value name="LEFT">
                          <block type="environment_price"></block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">0.015</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_stop_loss">
                        <field name="TRADE_ID">rsi_reversal_trade</field>
                        <value name="PRICE">
                          <block type="operator_subtract">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="environment_price"></block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">0.01</field>
                                  </shadow>
                                </value>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: "bollinger-breakout",
    name: "Bollinger Band Breakout",
    description:
      "Enter trades when price breaks above upper band (bullish) or below lower band (bearish). Volatility breakout strategy.",
    difficulty: "intermediate",
    category: "breakout",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_greater">
                <value name="LEFT">
                  <block type="environment_price"></block>
                </value>
                <value name="RIGHT">
                  <block type="ta_bb">
                    <mutation period="20" ma_period="20" deviation="2" shift="0" applied_price="0"></mutation>
                    <field name="NAME">BB</field>
                    <field name="COMPONENT">upper</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO">
              <block type="trade_order">
                <field name="TRADE_ID">bollinger_breakout_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">100</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">value</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_stop_loss">
                    <field name="TRADE_ID">bollinger_breakout_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="environment_price"></block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">0.02</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: "macd-momentum",
    name: "MACD Momentum",
    description:
      "Buy when MACD crosses above signal line, sell when it crosses below. Momentum-based strategy with trend confirmation.",
    difficulty: "intermediate",
    category: "momentum",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_and">
                <value name="LEFT">
                  <block type="operator_greater">
                    <value name="LEFT">
                      <block type="macd_value">
                        <mutation period="5" fastema="12" slowema="26" signalsma="9" applied_price="0"></mutation>
                        <field name="NAME">MACD</field>
                        <field name="COMPONENT">line</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="macd_value">
                        <mutation period="5" fastema="12" slowema="26" signalsma="9" applied_price="0"></mutation>
                        <field name="NAME">MACD</field>
                        <field name="COMPONENT">signal</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="operator_greater">
                    <value name="LEFT">
                      <block type="ta_adx">
                        <mutation period="14" ma_period="14"></mutation>
                        <field name="NAME">ADX</field>
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
              <block type="trade_order">
                <field name="TRADE_ID">macd_momentum_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">0.6</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">percent</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_stop_loss">
                    <field name="TRADE_ID">macd_momentum_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="environment_price"></block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">0.01</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: "scalping-vwap",
    name: "VWAP Scalping",
    description:
      "Quick scalping strategy: buy when price is below VWAP with RSI oversold, tight stops. For high-frequency trading.",
    difficulty: "advanced",
    category: "scalping",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_and">
                <value name="LEFT">
                  <block type="operator_less">
                    <value name="LEFT">
                      <block type="environment_price"></block>
                    </value>
                    <value name="RIGHT">
                      <block type="ta_vwap">
                        <mutation period="5"></mutation>
                        <field name="NAME">VWAP</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="operator_less">
                    <value name="LEFT">
                      <block type="ta_rsi">
                        <mutation period="14" ma_period="14" applied_price="0"></mutation>
                        <field name="NAME">RSI</field>
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
              <block type="trade_order">
                <field name="TRADE_ID">vwap_scalping_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">50</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">value</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_stop_loss">
                    <field name="TRADE_ID">vwap_scalping_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="environment_price"></block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">0.005</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="TRADE_ID">vwap_scalping_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="environment_price"></block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="environment_price"></block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">0.008</field>
                                  </shadow>
                                </value>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
  {
    id: "triple-ema-trend",
    name: "Triple EMA Trend",
    description:
      "Advanced trend following with three EMAs. Enter when fast > medium > slow (aligned trend). Strong trend filter.",
    difficulty: "advanced",
    category: "trend",
    workspace: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="control_forever" x="50" y="50">
        <statement name="DO">
          <block type="control_if">
            <value name="CONDITION">
              <block type="operator_and">
                <value name="LEFT">
                  <block type="operator_greater">
                    <value name="LEFT">
                      <block type="ta_ema">
                        <mutation period="9" ma_period="14" shift="0" applied_price="0"></mutation>
                        <field name="NAME">EMA</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="ta_ema">
                        <mutation period="21" ma_period="14" shift="0" applied_price="0"></mutation>
                        <field name="NAME">EMA</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="operator_greater">
                    <value name="LEFT">
                      <block type="ta_ema">
                        <mutation period="21" ma_period="14" shift="0" applied_price="0"></mutation>
                        <field name="NAME">EMA</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="ta_ema">
                        <mutation period="55" ma_period="14" shift="0" applied_price="0"></mutation>
                        <field name="NAME">EMA</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO">
              <block type="trade_order">
                <field name="TRADE_ID">triple_ema_trade</field>
                <field name="DIRECTION">long</field>
                <value name="SIZE">
                  <shadow type="math_number">
                    <field name="NUM">4</field>
                  </shadow>
                </value>
                <field name="SIZE_TYPE">percent</field>
                <field name="LEVERAGE">1</field>
                <field name="ORDER_TYPE">market</field>
                <next>
                  <block type="trade_close">
                    <field name="TRADE_ID">triple_ema_trade</field>
                    <value name="PERCENT">
                      <shadow type="math_number">
                        <field name="NUM">100</field>
                      </shadow>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </statement>
      </block>
    </xml>`,
  },
];

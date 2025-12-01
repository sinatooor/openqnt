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
      "Buy when fast MA crosses above slow MA, sell when it crosses below. Classic golden cross strategy with 50/200 SMA.",
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
                    <mutation period="5" ma_period="50" shift="0" applied_price="0"></mutation>
                    <field name="NAME">Fast SMA</field>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="ta_sma">
                    <mutation period="5" ma_period="200" shift="0" applied_price="0"></mutation>
                    <field name="NAME">Slow SMA</field>
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
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">ma_crossover_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">ma_crossover_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">2</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">ma_crossover_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">ma_crossover_trade</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">2</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">3</field>
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
      "Buy when RSI drops below 30 (oversold), sell when it rises above 70 (overbought). Standard 14-period RSI mean reversion strategy.",
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
                    <mutation period="5" ma_period="14" applied_price="0"></mutation>
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
                  <block type="trade_stop_loss">
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">rsi_reversal_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">rsi_reversal_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">1.5</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">rsi_reversal_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">rsi_reversal_trade</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">1.5</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">2</field>
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
      "Enter trades when price breaks above upper band (bullish) or below lower band (bearish). Standard 20-period, 2-deviation volatility breakout strategy.",
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
                    <mutation period="5" ma_period="20" deviation="2" shift="0" applied_price="0"></mutation>
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
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">bollinger_breakout_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">bollinger_breakout_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">2.5</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">bollinger_breakout_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">bollinger_breakout_trade</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">2.5</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">3</field>
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
    id: "macd-momentum",
    name: "MACD Momentum",
    description:
      "Buy when MACD crosses above signal line with ADX>25 trend confirmation. Standard MACD(12,26,9) momentum strategy.",
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
                        <mutation period="5" ma_period="14"></mutation>
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
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">macd_momentum_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">macd_momentum_trade</field>
                          </block>
                        </value>
                         <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">2</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">macd_momentum_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">macd_momentum_trade</field>
                              </block>
                            </value>
                             <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">2</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">3</field>
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
    id: "scalping-vwap",
    name: "VWAP Scalping",
    description:
      "Quick scalping strategy: buy when price is below VWAP with RSI(9)<40. Tight stops for high-frequency trading.",
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
                        <mutation period="5" ma_period="9" applied_price="0"></mutation>
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
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">vwap_scalping_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">vwap_scalping_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">1</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">vwap_scalping_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">vwap_scalping_trade</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">1</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">2</field>
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
      "Advanced trend following with three EMAs (8,21,55 Fibonacci periods). Enter when fast > medium > slow (aligned trend). Strong trend filter.",
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
                        <mutation period="5" ma_period="8" shift="0" applied_price="0"></mutation>
                        <field name="NAME">Fast EMA</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="ta_ema">
                        <mutation period="5" ma_period="21" shift="0" applied_price="0"></mutation>
                        <field name="NAME">Medium EMA</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="RIGHT">
                  <block type="operator_greater">
                    <value name="LEFT">
                      <block type="ta_ema">
                        <mutation period="5" ma_period="21" shift="0" applied_price="0"></mutation>
                        <field name="NAME">Medium EMA</field>
                      </block>
                    </value>
                    <value name="RIGHT">
                      <block type="ta_ema">
                        <mutation period="5" ma_period="55" shift="0" applied_price="0"></mutation>
                        <field name="NAME">Slow EMA</field>
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
                  <block type="trade_stop_loss">
                    <field name="CLOSE_TYPE">full</field>
                    <field name="TRADE_ID">triple_ema_trade</field>
                    <value name="PRICE">
                      <block type="operator_subtract">
                        <value name="LEFT">
                          <block type="trade_entry_price">
                            <field name="TRADE_ID">triple_ema_trade</field>
                          </block>
                        </value>
                        <value name="RIGHT">
                          <block type="operator_multiply">
                            <value name="LEFT">
                              <block type="ta_atr">
                                <mutation period="5" ma_period="14"></mutation>
                                <field name="NAME">ATR</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <shadow type="math_number">
                                <field name="NUM">2</field>
                              </shadow>
                            </value>
                          </block>
                        </value>
                      </block>
                    </value>
                    <next>
                      <block type="trade_take_profit">
                        <field name="CLOSE_TYPE">full</field>
                        <field name="TRADE_ID">triple_ema_trade</field>
                        <value name="PRICE">
                          <block type="operator_add">
                            <value name="LEFT">
                              <block type="trade_entry_price">
                                <field name="TRADE_ID">triple_ema_trade</field>
                              </block>
                            </value>
                            <value name="RIGHT">
                              <block type="operator_multiply">
                                <value name="LEFT">
                                  <block type="operator_multiply">
                                    <value name="LEFT">
                                      <block type="ta_atr">
                                        <mutation period="5" ma_period="14"></mutation>
                                        <field name="NAME">ATR</field>
                                      </block>
                                    </value>
                                    <value name="RIGHT">
                                      <shadow type="math_number">
                                        <field name="NUM">2</field>
                                      </shadow>
                                    </value>
                                  </block>
                                </value>
                                <value name="RIGHT">
                                  <shadow type="math_number">
                                    <field name="NUM">3</field>
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
];

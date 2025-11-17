import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating strategy for:", message);

    const systemPrompt = `You are a trading strategy expert that creates Blockly XML code for visual programming.

Available blocks and their usage:

Control Flow:
- control_if: Conditional logic with CONDITION value and DO statement
- control_if_else: If-else logic with CONDITION value, DO and ELSE statements

Technical Indicators:
- ta_sma: Simple Moving Average (PERIOD input)
- ta_ema: Exponential Moving Average (PERIOD input)
- ta_rsi: Relative Strength Index (PERIOD input) 
- ta_macd: MACD indicator
- ta_bb: Bollinger Bands (PERIOD input)
- ta_adx: Average Directional Index (PERIOD input)
- ta_stochastic: Stochastic oscillator (K_PERIOD, D_PERIOD inputs)
- ta_atr: Average True Range (PERIOD input)

Operators:
- operator_greater, operator_less: Comparison operators with LEFT and RIGHT values
- operator_and, operator_or: Logical operators with LEFT and RIGHT values
- operator_equal, operator_not_equal: Equality operators

Trade Actions:
- trade_order: Place order (TRADE_ID field, DIRECTION field [long/short], SIZE value, SIZE_TYPE field [percent/value], LEVERAGE field, ORDER_TYPE field [market/limit])
- trade_stop_loss: Set stop loss (TRADE_ID field, PRICE value, CLOSE_TYPE field [full/partial])
- trade_take_profit: Set take profit (TRADE_ID field, PRICE value, CLOSE_TYPE field [full/partial])
- trade_close: Close position (TRADE_ID field)

Environment:
- environment_price: Current price
- environment_volume: Current volume
- math_number: Numeric value (NUM field)

Variables:
- variable_set: Set variable (VAR_NAME field, VALUE input)
- variable_get: Get variable value (VAR_NAME field)

EXAMPLES:

Example 1 - Simple MA Crossover Strategy:
Prompt: "Buy when fast MA crosses above slow MA, sell when it crosses below"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
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
              <shadow type="math_number">
                <field name="NUM">2</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 2 - RSI Oversold Reversal:
Prompt: "Buy when RSI drops below 30, sell when it rises above 70"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
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
              <shadow type="math_number">
                <field name="NUM">5</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 3 - Bollinger Band Breakout:
Prompt: "Enter long when price breaks above upper Bollinger Band"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
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
              <shadow type="math_number">
                <field name="NUM">1.5</field>
              </shadow>
            </value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

Example 4 - MACD Momentum with ADX Filter:
Prompt: "Buy when MACD is positive and ADX is above 25"
Output:
<xml xmlns="https://developers.google.com/blockly/xml">
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
      <block type="trade_order">
        <field name="TRADE_ID">macd_momentum_trade</field>
        <field name="DIRECTION">long</field>
        <value name="SIZE">
          <shadow type="math_number">
            <field name="NUM">5</field>
          </shadow>
        </value>
        <field name="SIZE_TYPE">percent</field>
        <field name="LEVERAGE">2</field>
        <field name="ORDER_TYPE">market</field>
        <next>
          <block type="trade_stop_loss">
            <field name="TRADE_ID">macd_momentum_trade</field>
            <value name="PRICE">
              <shadow type="math_number">
                <field name="NUM">3</field>
              </shadow>
            </value>
            <next>
              <block type="trade_take_profit">
                <field name="TRADE_ID">macd_momentum_trade</field>
                <value name="PRICE">
                  <shadow type="math_number">
                    <field name="NUM">6</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>

IMPORTANT RULES:
1. Always start with <xml xmlns="https://developers.google.com/blockly/xml">
2. Use proper block nesting with <value>, <statement>, and <next> tags
3. Include unique TRADE_ID for each strategy
4. Add risk management (stop loss or take profit) after opening trades
5. Use <shadow type="math_number"> for numeric inputs
6. Keep strategies comprehensive and ready to use
7. Set x="50" y="50" for the first block positioning`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate Blockly XML for this trading strategy: ${message}\n\nReturn ONLY the XML wrapped in <xml></xml> tags. No explanations.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("Generated XML:", content);

    return new Response(JSON.stringify({ xml: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-strategy:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
    const { message, currentWorkspace, blockXml } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const blockCount = currentWorkspace ? (currentWorkspace.match(/<block /g) || []).length : 0;
    console.log("Generating strategy for:", message);
    console.log("Has existing workspace:", !!currentWorkspace, `(${blockCount} blocks, ${(currentWorkspace?.length || 0) / 1024}KB)`);
    console.log("Has specific block attached:", !!blockXml);
    console.log("Is modification request:", !!currentWorkspace);

    let systemPrompt = `You are a trading strategy expert that creates Blockly XML code for visual programming.

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
7. Set x="50" y="50" for the first block positioning
8. CRITICAL: Block IDs must ONLY contain alphanumeric characters, underscores, and hyphens
9. Never use special characters like (), {}, [], /, #, !, @, $, %, ^, &, *, +, =, etc. in block IDs
10. Good IDs: "rsi_check", "trade_entry_1", "stop_loss_block", "condition-main"
11. Bad IDs: "4k)r_ds#rs", "block/1", "condition[0]", "test(1)"
12. Generate clean, simple alphanumeric IDs only`;

    // Add block context if provided
    if (blockXml) {
      systemPrompt += `\n\nThe user has shared a specific Blockly block with you. Here is the XML structure:\n\n${blockXml}\n\nPlease focus on this block when generating or modifying the strategy. Analyze what this block does and incorporate it or provide context about it in your response.`;
    }

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
            content: currentWorkspace 
              ? `Here is my current trading strategy workspace:\n\n${currentWorkspace}\n\nPlease modify it according to this request: ${message}\n\nReturn ONLY the complete updated XML wrapped in <xml></xml> tags. No explanations.`
              : `Generate Blockly XML for this trading strategy: ${message}\n\nReturn ONLY the XML wrapped in <xml></xml> tags. No explanations.`,
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

    // Validate response isn't just whitespace
    if (!content.trim()) {
      throw new Error("AI returned empty response");
    }

    // Validate response size (max 1MB)
    if (content.length > 1024 * 1024) {
      throw new Error("AI response is too large");
    }

    // Extract XML content from response (in case AI added explanation text)
    let xmlContent = content.trim();
    const xmlMatch = xmlContent.match(/<xml[^>]*>[\s\S]*<\/xml>/i);
    
    if (xmlMatch) {
      xmlContent = xmlMatch[0];
    } else {
      // Check if response contains XML tags at all
      if (!xmlContent.includes('<xml') || !xmlContent.includes('</xml>')) {
        console.error("Invalid AI response - no XML tags found:", xmlContent);
        throw new Error("AI did not generate valid Blockly XML. Please try rephrasing your request.");
      }
    }

    // Validate XML starts with proper root element
    if (!xmlContent.trim().startsWith('<xml')) {
      console.error("Invalid XML format - doesn't start with <xml>:", xmlContent.substring(0, 100));
      throw new Error("Generated XML format is invalid");
    }

    // Validate block IDs don't contain invalid characters
    const invalidIdMatch = xmlContent.match(/id="([^"]*[^a-zA-Z0-9_-][^"]*)"/);
    if (invalidIdMatch) {
      console.error("Invalid block ID detected:", invalidIdMatch[1]);
      throw new Error(`Generated XML contains invalid block ID with special characters: ${invalidIdMatch[1]}`);
    }

    // Count blocks for logging
    const generatedBlockCount = (xmlContent.match(/<block /g) || []).length;
    console.log(`Generated XML validated: ${generatedBlockCount} blocks, ${xmlContent.length} chars`);
    console.log("XML preview:", xmlContent.substring(0, 200) + "...");

    return new Response(JSON.stringify({ xml: xmlContent }), {
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

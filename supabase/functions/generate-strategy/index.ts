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

    const systemPrompt = `You are a trading strategy code generator. Generate Blockly XML for trading strategies based on user descriptions.

Available blocks:
- control_if: Conditional logic with CONDITION input and THEN/ELSE statements
- control_repeat: Loop with TIMES field
- operator_greater/less/equals: Comparison operators with LEFT and RIGHT inputs
- operator_and/or/not: Logical operators
- math_number: Number value with NUM field
- ta_sma/ema/rsi/macd: Technical indicators with PERIOD field
- environment_price: Current market price
- environment_prev_candle_open/close: Previous candle data with TIMEFRAME field (1m/5m/15m/1h/4h/1d)
- trade_order: Execute trade with fields: TRADE_ID, DIRECTION (long/short), SIZE, SIZE_TYPE (percent/fixed), LEVERAGE, ORDER_TYPE (market/limit)
- trade_stop_loss/take_profit: Risk management with TRADE_ID and PRICE fields
- variables_set/get/change: Variable operations

Generate valid Blockly XML. Keep strategies simple and practical. Maximum 40 blocks.`;

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
          { role: "user", content: `Generate Blockly XML for this trading strategy: ${message}\n\nReturn ONLY the XML wrapped in <xml></xml> tags. No explanations.` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("Generated XML:", content);

    return new Response(
      JSON.stringify({ xml: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-strategy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

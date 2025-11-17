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
    const { message, workspaceXml, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat message:", message);
    console.log("Has workspace context:", !!workspaceXml);

    const systemPrompt = `You are a helpful trading strategy assistant. You can have natural conversations about trading strategies, brainstorm ideas, and help users build their strategies using Blockly blocks.

When the user wants to add/modify/remove blocks, generate the appropriate Blockly XML. Otherwise, just chat naturally and provide helpful advice.

Available Blockly blocks:
- Control Flow: if (control_if, control_if_else), loops (control_repeat, control_forever, control_repeat_until), wait (control_wait, control_wait_until), stop (control_stop)
- Market Data: current price (env_price), spread (env_spread), time (env_time), day of week (env_day_of_week), market status (env_is_market_open)
- Comparisons: equals/not equals (operator_equals, operator_not_equals), greater/less than (operator_greater, operator_less, operator_greater_equals, operator_less_equals)
- Logic: AND/OR/NOT (operator_and, operator_or, operator_not)
- Math: basic ops (operator_add, operator_subtract, operator_multiply, operator_divide), advanced (operator_advanced_math)
- Technical Indicators: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR, ADX, CCI (ta_sma, ta_ema, ta_rsi, ta_macd, ta_bollinger_bands, ta_stochastic, ta_atr, ta_adx, ta_cci)
- Multi-Timeframe: access other timeframes (mtf_indicator with SMA, EMA, RSI options)
- Trading Actions: place orders (trade_order), set stop loss/take profit (trade_stop_loss, trade_take_profit), close positions (trade_close)
- Trade Info: get P&L (trade_pnl_of), entry price (trade_entry_price), position size (trade_position_size)
- Risk Management: position sizing (risk_position_percent, risk_kelly_criterion, risk_fixed_amount), stops (risk_trailing_stop), scaling (risk_scale_in, risk_scale_out), limits (risk_max_drawdown, risk_daily_loss_limit)
- Values: numbers (math_number), text (text), true/false (logic_boolean)
- Variables: create/update (variables_set, variables_change), read (variables_get)
- Functions: define (function_define), call (function_call), return (function_return)

${workspaceXml ? 'Current workspace has existing blocks. When adding blocks, you can reference and connect to existing blocks.' : 'Workspace is currently empty.'}

Instructions:
- Chat naturally when brainstorming or discussing strategies
- Only generate XML when the user explicitly wants to implement something (e.g., "add blocks for", "create", "implement", "remove", "modify")
- When generating blocks, return complete, valid Blockly XML wrapped in <xml xmlns="https://developers.google.com/blockly/xml"> tags
- Use proper block IDs and connections
- For modifying existing blocks, generate new XML that replaces or adds to the workspace`;

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: "user", content: message });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
    const generatedText = data.choices[0].message.content;

    const hasXml = generatedText.includes('<xml') && generatedText.includes('</xml>');
    
    console.log("Generated response type:", hasXml ? "blocks" : "conversation");

    return new Response(
      JSON.stringify({ 
        message: generatedText,
        hasBlocks: hasXml
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-strategy:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

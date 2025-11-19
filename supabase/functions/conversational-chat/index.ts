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
    const { messages, blockXml } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = `You are a helpful trading strategy assistant with expertise in technical analysis, trading strategies, and financial markets. You provide clear, educational responses about trading concepts, indicators, and strategies.

You help users understand:
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands, etc.)
- Trading strategies and their applications
- Risk management principles
- Market analysis concepts
- Best practices for algorithmic trading

Be conversational, friendly, and educational. If users ask about implementing strategies, remind them they can switch to "Generate" mode to create actual trading blocks.`;

    // Add block context if provided
    if (blockXml) {
      systemPrompt += `\n\nThe user has shared a specific Blockly block with you. Here is the XML structure:\n\n${blockXml}\n\nPlease analyze this block and answer the user's questions about it. Explain what the block does, how it works in a trading strategy, and provide insights about its usage. Be specific and educational.`;
      console.log("Block XML provided for context");
    }

    console.log("Calling Lovable AI for conversational chat...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Credits exhausted. Please add credits to continue.");
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Lovable AI response received");

    const assistantResponse = data.choices?.[0]?.message?.content;
    if (!assistantResponse) {
      throw new Error("No response from AI");
    }

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in conversational-chat function:", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceXml, strategyName } = await req.json();

    console.log('Received request to generate MQL code');
    console.log('Strategy name:', strategyName);
    console.log('Workspace XML length:', workspaceXml?.length);

    if (!workspaceXml) {
      return new Response(
        JSON.stringify({ error: 'No workspace XML provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load MQL5 syntax reference
    let mql5Syntax = '';
    try {
      const syntaxResponse = await fetch(new URL('/mql5_syntax.json', req.url).toString());
      if (syntaxResponse.ok) {
        const syntaxData = await syntaxResponse.json();
        mql5Syntax = JSON.stringify(syntaxData, null, 2);
      }
    } catch (error) {
      console.warn('Could not load MQL5 syntax file:', error);
    }

    // Extract detailed block structure from workspace XML
    let blockStructure = '';
    try {
      const blockMatches = Array.from(workspaceXml.matchAll(/<block type="([^"]+)"[^>]*>/g)) as RegExpMatchArray[];
      const blocks: { [key: string]: number } = {};

      blockMatches.forEach(match => {
        const blockType = match[1];
        blocks[blockType] = (blocks[blockType] || 0) + 1;
      });

      if (Object.keys(blocks).length > 0) {
        blockStructure = '\n\nBLOCK STRUCTURE:\n' +
          Object.entries(blocks)
            .map(([type, count]) => `- ${type.replace(/_/g, ' ')} (${count}x)`)
            .join('\n');
      }

      // Extract field values for more context
      const fieldMatches = Array.from(workspaceXml.matchAll(/<field name="([^"]+)">([^<]+)<\/field>/g)) as RegExpMatchArray[];
      if (fieldMatches.length > 0) {
        blockStructure += '\n\nFIELD VALUES:\n';
        fieldMatches.slice(0, 20).forEach(match => {
          blockStructure += `- ${match[1]}: ${match[2]}\n`;
        });
      }
    } catch (error) {
      console.warn('Could not parse workspace XML:', error);
    }

    // Build comprehensive prompt for MQL5 generation
    const systemPrompt = `You are an expert MQL5 programmer specializing in creating production-quality MetaTrader 5 Expert Advisors.

Your task is to analyze a trading strategy represented as visual blocks (in XML format) and generate complete, compilable MQL5 Expert Advisor code.

${mql5Syntax ? `MQL5 SYNTAX REFERENCE:\n${mql5Syntax}\n\n` : ''}

REQUIREMENTS:
1. Generate complete, compilable MQL5 code for MetaTrader 5
2. Use proper MQL5 built-in functions:
   - OrderSend() for placing trades
   - OrderClose() for closing positions
   - OrderSelect() for selecting orders
   - Technical indicators: iRSI(), iMA(), iMACD(), iStochastic(), iBands(), iATR(), etc.
   - Price data: Open[], High[], Low[], Close[], Volume[]
3. Include proper error handling with GetLastError()
4. Follow MQL5 best practices and coding standards
5. Include #property directives at the top
6. Implement OnInit(), OnDeinit(), and OnTick() functions
7. Add clear comments explaining the strategy logic
8. Use proper variable declarations and types
9. Implement position sizing and risk management
10. Handle order management correctly (check for existing positions)

BLOCK TYPE MEANINGS:
- environment_price: Access price data (Open, High, Low, Close)
- indicator_* : Technical analysis indicators (RSI, MA, MACD, etc.)
- control_if: Conditional logic
- control_forever: Main strategy loop (goes in OnTick)
- trade_order: Place buy/sell orders
- trade_stop_loss: Set stop loss
- trade_take_profit: Set take profit
- operator_*: Arithmetic and comparison operations
- math_number: Numeric values

IMPORTANT:
- Return ONLY the MQL5 code without markdown formatting or explanations
- Ensure all indicator calls use correct MQL5 function signatures
- Include proper Symbol() and Period() in indicator calls
- Handle trade execution errors properly
- Use proper lot sizing (0.01, 0.1, 1.0, etc.)`;

    const userPrompt = `Generate a complete MQL5 Expert Advisor for the strategy: "${strategyName || 'Trading Strategy'}"

WORKSPACE BLOCKS:
${blockStructure}

FULL XML STRUCTURE:
\`\`\`xml
${workspaceXml}
\`\`\`

Generate the complete MQL5 Expert Advisor code that implements this trading strategy.`;

    console.log('Calling Lovable AI for MQL generation from blocks...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to generate MQL code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedCode = aiData.choices?.[0]?.message?.content || '';

    if (!generatedCode) {
      console.error('No code returned from AI');
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedCode = generatedCode.trim();
    if (cleanedCode.startsWith('```')) {
      cleanedCode = cleanedCode.replace(/^```(?:mql5|mql)?\n/, '').replace(/\n```$/, '');
    }

    console.log('Successfully generated MQL code from blocks');

    return new Response(
      JSON.stringify({ mqlCode: cleanedCode }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error generating MQL code:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

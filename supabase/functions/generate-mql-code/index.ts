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
    const { draftMql, workspaceXml, strategyName } = await req.json();
    
    console.log('Received request to generate MQL code');
    console.log('Strategy name:', strategyName);
    console.log('Draft MQL length:', draftMql?.length);
    console.log('Workspace XML length:', workspaceXml?.length);

    if (!draftMql) {
      return new Response(
        JSON.stringify({ error: 'No draft MQL code provided' }),
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

    // Load MQL4 syntax reference
    let mql4Syntax = '';
    try {
      const syntaxResponse = await fetch(new URL('/mql4_syntax.json', req.url).toString());
      if (syntaxResponse.ok) {
        const syntaxData = await syntaxResponse.json();
        mql4Syntax = JSON.stringify(syntaxData, null, 2);
      }
    } catch (error) {
      console.warn('Could not load MQL4 syntax file:', error);
      // Continue without syntax reference
    }

    // Extract block descriptions from workspace XML
    let blockDescriptions = '';
    if (workspaceXml) {
      try {
        // Parse basic block info from XML
        const blockMatches = Array.from(workspaceXml.matchAll(/<block type="([^"]+)"/g)) as RegExpMatchArray[];
        const blockTypes = blockMatches.map(m => m[1]);
        if (blockTypes.length > 0) {
          blockDescriptions = `\n\nBLOCK TYPES USED:\n${blockTypes.map((type, i) => `${i + 1}. ${type.replace(/_/g, ' ')}`).join('\n')}`;
        }
      } catch (error) {
        console.warn('Could not parse workspace XML:', error);
      }
    }

    // Build comprehensive prompt
    const systemPrompt = `You are an expert MQL4 programmer specializing in converting trading strategy logic into production-quality MetaTrader 4 Expert Advisor code.

Your task is to take draft MQL4 code generated from visual blocks and refine it into clean, compilable, professional EA code.

${mql4Syntax ? `MQL4 SYNTAX REFERENCE:\n${mql4Syntax}\n` : ''}

REQUIREMENTS:
1. Produce compilable MQL4 code that will work in MetaTrader 4
2. Use proper MQL4 built-in functions (OrderSend, OrderClose, iRSI, iMA, iMACD, etc.)
3. Include proper error handling with GetLastError()
4. Follow MQL4 best practices and coding standards
5. Preserve the exact trading logic from the draft code
6. Add helpful comments explaining the strategy logic
7. Include proper variable declarations and type safety
8. Use correct MQL4 order management (OrderSelect, OrderTicket, etc.)
9. Implement proper position sizing and risk management
10. Return ONLY the MQL4 code without any explanations or markdown formatting

IMPORTANT:
- Do NOT add features not present in the draft code
- Do NOT change the core trading logic
- Focus on syntax correctness and MQL4 compliance
- Ensure all indicator calls use correct MQL4 function signatures`;

    const userPrompt = `Please refine this MQL4 Expert Advisor code for the strategy "${strategyName || 'Untitled Strategy'}".
${blockDescriptions}

DRAFT CODE TO REFINE:
\`\`\`mql4
${draftMql}
\`\`\`

Return the refined, production-ready MQL4 code.`;

    console.log('Calling Lovable AI for MQL generation...');
    
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
    const refinedCode = aiData.choices?.[0]?.message?.content || '';

    if (!refinedCode) {
      console.error('No code returned from AI');
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedCode = refinedCode.trim();
    if (cleanedCode.startsWith('```')) {
      cleanedCode = cleanedCode.replace(/^```(?:mql4|mql)?\n/, '').replace(/\n```$/, '');
    }

    console.log('Successfully generated refined MQL code');
    
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

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// STEP 2: Static Analysis Function
// ============================================================
interface AnalysisResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function analyzeMqlCode(code: string): AnalysisResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required functions
  if (!code.includes('OnInit()') && !code.includes('OnInit ()')) {
    errors.push('Missing OnInit() function - required for EA initialization');
  }
  if (!code.includes('OnTick()') && !code.includes('OnTick ()')) {
    errors.push('Missing OnTick() function - required for price updates');
  }
  if (!code.includes('OnDeinit') && !code.includes('OnDeinit ()')) {
    warnings.push('Missing OnDeinit() function - recommended for cleanup');
  }

  // Check for balanced braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces: ${openBraces} opening vs ${closeBraces} closing`);
  }

  // Check for balanced parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses: ${openParens} opening vs ${closeParens} closing`);
  }

  // Check for #property directives
  if (!code.includes('#property')) {
    warnings.push('Missing #property directives at the top of the file');
  }

  // Check for error handling after OrderSend
  if (code.includes('OrderSend') && !code.includes('GetLastError')) {
    warnings.push('OrderSend() used without GetLastError() - add error handling');
  }

  // Check for proper Symbol() usage in indicator calls
  const indicatorCalls = ['iRSI', 'iMA', 'iMACD', 'iStochastic', 'iBands', 'iATR', 'iCCI', 'iADX'];
  indicatorCalls.forEach(indicator => {
    if (code.includes(indicator + '(')) {
      // Check if Symbol() or NULL is used
      const regex = new RegExp(indicator + '\\s*\\([^)]*\\)', 'g');
      const matches = code.match(regex) || [];
      matches.forEach(match => {
        if (!match.includes('Symbol()') && !match.includes('NULL') && !match.includes('_Symbol')) {
          warnings.push(`${indicator}() should use Symbol() or NULL for current symbol`);
        }
      });
    }
  });

  // Check for magic number
  if (code.includes('OrderSend') && !code.includes('MagicNumber') && !code.includes('MAGIC')) {
    warnings.push('Consider using a MagicNumber to identify orders from this EA');
  }

  // Check for lot size validation
  if (code.includes('OrderSend') && !code.includes('MarketInfo') && !code.includes('MODE_MINLOT')) {
    warnings.push('Consider validating lot size against broker limits (MODE_MINLOT, MODE_MAXLOT)');
  }

  // Check for spread check before trading
  if (code.includes('OrderSend') && !code.includes('MarketInfo') && !code.includes('MODE_SPREAD')) {
    warnings.push('Consider checking spread before placing orders');
  }

  // Check for common syntax errors
  if (code.includes(';;')) {
    errors.push('Double semicolon found - possible syntax error');
  }

  // Check for return type in functions
  if (code.includes('int OnInit()') || code.includes('int OnInit ()')) {
    if (!code.match(/OnInit\s*\([^)]*\)\s*\{[^}]*return\s+INIT_SUCCEEDED/s) &&
      !code.match(/OnInit\s*\([^)]*\)\s*\{[^}]*return\s+0/s)) {
      warnings.push('OnInit() should return INIT_SUCCEEDED or 0');
    }
  }

  // Check for extern/input variables
  if (!code.includes('extern ') && !code.includes('input ')) {
    warnings.push('No input parameters found - consider adding configurable settings');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceXml, strategyName } = await req.json();

    console.log('=== MQL GENERATION PIPELINE START ===');
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

    // ============================================================
    // STEP 1: Generate MQL Code (First Gemini Call)
    // ============================================================
    console.log('=== STEP 1: Generating MQL code ===');

    const systemPrompt = `You are an expert MQL4 programmer specializing in creating production-quality MetaTrader 4 Expert Advisors.

Your task is to analyze a trading strategy represented as visual blocks (in XML format) and generate complete, compilable MQL4 Expert Advisor code.

${mql4Syntax ? `MQL4 SYNTAX REFERENCE:\n${mql4Syntax}\n\n` : ''}

REQUIREMENTS:
1. Generate complete, compilable MQL4 code for MetaTrader 4
2. Use proper MQL4 built-in functions:
   - OrderSend() for placing trades
   - OrderClose() for closing positions
   - OrderSelect() for selecting orders
   - Technical indicators: iRSI(), iMA(), iMACD(), iStochastic(), iBands(), iATR(), etc.
   - Price data: Open[], High[], Low[], Close[], Volume[]
3. Include proper error handling with GetLastError()
4. Follow MQL4 best practices and coding standards
5. Include #property directives at the top
6. Implement OnInit(), OnDeinit(), and OnTick() functions
7. Add clear comments explaining the strategy logic
8. Use proper variable declarations and types
9. Implement position sizing and risk management
10. Handle order management correctly (check for existing positions)
11. Use a MagicNumber to identify orders from this EA
12. Validate lot size against broker limits
13. Use extern or input variables for configurable parameters

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
- Return ONLY the MQL4 code without markdown formatting or explanations
- Ensure all indicator calls use correct MQL4 function signatures
- Include proper Symbol() and Period() in indicator calls
- Handle trade execution errors properly
- Use proper lot sizing (0.01, 0.1, 1.0, etc.)`;

    const userPrompt = `Generate a complete MQL4 Expert Advisor for the strategy: "${strategyName || 'Trading Strategy'}"

WORKSPACE BLOCKS:
${blockStructure}

FULL XML STRUCTURE:
\`\`\`xml
${workspaceXml}
\`\`\`

Generate the complete MQL4 Expert Advisor code that implements this trading strategy.`;

    const firstResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

    if (!firstResponse.ok) {
      const errorText = await firstResponse.text();
      console.error('AI gateway error (Step 1):', firstResponse.status, errorText);

      if (firstResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (firstResponse.status === 402) {
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

    const firstData = await firstResponse.json();
    let generatedCode = firstData.choices?.[0]?.message?.content || '';

    if (!generatedCode) {
      console.error('No code returned from AI (Step 1)');
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up markdown formatting
    generatedCode = generatedCode.trim();
    if (generatedCode.startsWith('```')) {
      generatedCode = generatedCode.replace(/^```(?:mql4|mql)?\n/, '').replace(/\n```$/, '');
    }

    console.log('Step 1 complete: Generated', generatedCode.length, 'characters');

    // ============================================================
    // STEP 2: Static Analysis
    // ============================================================
    console.log('=== STEP 2: Running static analysis ===');

    const analysisResult = analyzeMqlCode(generatedCode);

    console.log('Static analysis results:');
    console.log('- Valid:', analysisResult.isValid);
    console.log('- Errors:', analysisResult.errors.length);
    console.log('- Warnings:', analysisResult.warnings.length);

    if (analysisResult.errors.length > 0) {
      console.log('Errors found:', analysisResult.errors);
    }
    if (analysisResult.warnings.length > 0) {
      console.log('Warnings found:', analysisResult.warnings);
    }

    // ============================================================
    // STEP 3: LLM Fix Pass (Second Gemini Call)
    // ============================================================
    console.log('=== STEP 3: LLM fix pass ===');

    const fixPrompt = `You are an expert MQL4 code reviewer and fixer.

Review the following MQL4 Expert Advisor code and fix any issues found.

ISSUES DETECTED BY STATIC ANALYSIS:
${analysisResult.errors.length > 0 ? 'ERRORS (must fix):\n' + analysisResult.errors.map(e => '- ' + e).join('\n') : 'No critical errors found.'}

${analysisResult.warnings.length > 0 ? 'WARNINGS (should fix):\n' + analysisResult.warnings.map(w => '- ' + w).join('\n') : 'No warnings.'}

REQUIREMENTS FOR THE FIX:
1. Fix ALL errors listed above
2. Address ALL warnings listed above
3. Ensure the code is complete and compilable
4. Keep all existing logic intact
5. Add any missing required functions (OnInit, OnTick, OnDeinit)
6. Ensure proper error handling with GetLastError()
7. Use Symbol() in all indicator calls
8. Add MagicNumber if missing
9. Add input/extern parameters if missing
10. Ensure balanced braces and parentheses

IMPORTANT:
- Return ONLY the fixed MQL4 code
- No markdown formatting
- No explanations
- Keep all original functionality`;

    const fixUserPrompt = `Fix this MQL4 Expert Advisor code:

${generatedCode}

Return the complete fixed code.`;

    const secondResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: fixPrompt },
          { role: 'user', content: fixUserPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    let finalCode = generatedCode;

    if (secondResponse.ok) {
      const secondData = await secondResponse.json();
      const fixedCode = secondData.choices?.[0]?.message?.content || '';

      if (fixedCode && fixedCode.trim()) {
        finalCode = fixedCode.trim();
        if (finalCode.startsWith('```')) {
          finalCode = finalCode.replace(/^```(?:mql4|mql)?\n/, '').replace(/\n```$/, '');
        }
        console.log('Step 3 complete: Fixed code is', finalCode.length, 'characters');
      } else {
        console.log('Step 3: Fix pass returned empty, using original code');
      }
    } else {
      console.log('Step 3: Fix pass failed, using original code');
    }

    // Run final analysis on the fixed code
    const finalAnalysis = analyzeMqlCode(finalCode);
    console.log('Final analysis - Errors:', finalAnalysis.errors.length, 'Warnings:', finalAnalysis.warnings.length);

    console.log('=== MQL GENERATION PIPELINE COMPLETE ===');

    return new Response(
      JSON.stringify({
        mqlCode: finalCode,
        analysis: {
          errors: finalAnalysis.errors,
          warnings: finalAnalysis.warnings
        }
      }),
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

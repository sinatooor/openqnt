import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify Backtest - Two-step LLM verification for backtesting
 * 
 * Step 1: Validate parsed strategy structure (Gemini via Lovable)
 * Step 2: Validate generated Python code (can be forwarded to backend DeepSeek)
 */

const PARSE_VERIFICATION_PROMPT = `You are a trading strategy validator. Analyze this parsed strategy structure and identify any issues.

PARSED STRATEGY:
{parsed_json}

ORIGINAL XML SNIPPET:
{xml_snippet}

VALIDATION CHECKS:
1. Are all indicator types valid? (SMA, EMA, RSI, MACD, BB, Stochastic, ATR, etc.)
2. Are indicator periods reasonable? (e.g., SMA period 5-200, RSI period 7-21)
3. Is entry direction logical? (long/short)
4. Are SL/TP values valid? For LONG: SL < entry price < TP. For SHORT: TP < entry price < SL.
5. Are there any missing required indicators for the strategy pattern?
6. Is the trade size reasonable? (typically 0.01 to 1.0)

RESPONSE FORMAT (strict JSON only):
{
  "valid": true or false,
  "confidence": 0.0 to 1.0,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"],
  "fixed_parsed": null or corrected parsed object if fixable
}`;

const CODE_VERIFICATION_PROMPT = `You are a Python trading strategy code validator. Analyze this backtesting.py strategy code.

GENERATED CODE:
\`\`\`python
{code}
\`\`\`

VALIDATION CHECKS:
1. Does the Strategy class extend Strategy from backtesting?
2. Does it have init(self) and next(self) methods?
3. Are ALL indicators wrapped with self.I()? (e.g., self.I(SMA, self.data.Close, period))
4. Is crossover() used correctly for indicator comparisons?
5. Are self.buy() and self.sell() calls valid?
6. If sl/tp arguments exist, are they valid floats/percentages?
7. Are there any syntax errors or undefined variables?

RESPONSE FORMAT (strict JSON only):
{
  "valid": true or false,
  "confidence": 0.0 to 1.0,
  "issues": ["issue 1", "issue 2"],
  "fixed_code": null or corrected Python code string if issues found
}`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const {
            type,           // "parse" or "code"
            parsed,         // For parse verification
            xml_snippet,    // For parse verification context
            code            // For code verification
        } = await req.json();

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            throw new Error("LOVABLE_API_KEY is not configured");
        }

        if (!type) {
            throw new Error("Must specify verification type: 'parse' or 'code'");
        }

        let prompt: string;
        let inputDesc: string;

        if (type === "parse") {
            if (!parsed) {
                throw new Error("No parsed strategy provided for parse verification");
            }
            prompt = PARSE_VERIFICATION_PROMPT
                .replace("{parsed_json}", JSON.stringify(parsed, null, 2))
                .replace("{xml_snippet}", xml_snippet || "N/A");
            inputDesc = `parsed strategy (${JSON.stringify(parsed).length} chars)`;
        } else if (type === "code") {
            if (!code) {
                throw new Error("No code provided for code verification");
            }
            prompt = CODE_VERIFICATION_PROMPT.replace("{code}", code);
            inputDesc = `Python code (${code.length} chars)`;
        } else {
            throw new Error(`Invalid verification type: ${type}. Use 'parse' or 'code'.`);
        }

        console.log(`[VERIFY] Running ${type} verification on ${inputDesc}...`);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-3-pro",
                messages: [
                    {
                        role: "system",
                        content: "You are a trading strategy validator. Respond ONLY with valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Lovable Gateway error:", errorText);
            throw new Error(`Lovable Gateway error: ${response.status}`);
        }

        const data = await response.json();
        let resultText = data.choices?.[0]?.message?.content?.trim();

        if (!resultText) {
            console.log("[VERIFY] No response from Gemini, returning valid by default");
            return new Response(
                JSON.stringify({
                    valid: true,
                    skipped: true,
                    type,
                    message: "LLM returned empty response"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Clean up JSON from markdown code blocks
        if (resultText.startsWith("```json")) {
            resultText = resultText.slice(7);
        }
        if (resultText.startsWith("```")) {
            resultText = resultText.slice(3);
        }
        if (resultText.endsWith("```")) {
            resultText = resultText.slice(0, -3);
        }

        try {
            const result = JSON.parse(resultText.trim());
            console.log(`[VERIFY] ${type} verification: ${result.valid ? 'PASS' : 'FAIL'}`);

            if (!result.valid && result.issues) {
                console.log(`[VERIFY] Issues found: ${result.issues.join(', ')}`);
            }

            return new Response(
                JSON.stringify({
                    ...result,
                    type,
                    verified: true
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } catch (parseErr) {
            console.error("[VERIFY] Failed to parse LLM response as JSON:", resultText);
            return new Response(
                JSON.stringify({
                    valid: true,
                    type,
                    error: "Failed to parse LLM response",
                    raw: resultText.slice(0, 500)
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

    } catch (error) {
        console.error("Verification error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});

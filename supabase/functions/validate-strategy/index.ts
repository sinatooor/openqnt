import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALIDATION_PROMPT = `You are a Trading Strategy XML Validator. Your task is to validate and fix Blockly XML for trading strategies.

VALIDATION RULES:
1. Check for identical indicators being compared (e.g., SMA(14) > SMA(14)) - FIX by making them Fast/Slow versions.
2. Check for scale incompatibility (e.g., Price > RSI) - FLAG as error.
3. Check for proper XML structure (all tags closed, valid block types).
4. Check that trade_order blocks have reasonable SIZE (default 0.1, not 100).
5. Check that timeframes are in minutes (60 for 1 hour, not "1h").
6. Check that SL/TP use ATR-based calculations.

INPUT XML:
{xml}

TASK:
1. Analyze the XML for any issues.
2. If issues found, fix them and return the corrected XML.
3. If no issues, return the original XML unchanged.

OUTPUT FORMAT:
Return ONLY the XML (corrected or original). No explanation, no markdown code blocks.`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { xml } = await req.json();
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            throw new Error("LOVABLE_API_KEY is not configured");
        }

        if (!xml) {
            throw new Error("No XML provided for validation");
        }

        console.log("Validating strategy XML with Gemini...");
        console.log(`XML size: ${(xml.length / 1024).toFixed(2)}KB`);

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
                        role: "user",
                        content: VALIDATION_PROMPT.replace("{xml}", xml),
                    },
                ],
                temperature: 0.1,
                max_tokens: 8192,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Lovable Gateway error:", errorText);
            throw new Error(`Lovable Gateway error: ${response.status}`);
        }

        const data = await response.json();
        // OpenAI-style response format from Lovable Gateway
        const validatedXml = data.choices?.[0]?.message?.content?.trim();

        if (!validatedXml) {
            console.log("No response from Gemini, returning original XML");
            return new Response(
                JSON.stringify({ xml, validated: false, ai_fixed: false }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Clean up any markdown code blocks if present
        let cleanXml = validatedXml;
        if (cleanXml.startsWith("```")) {
            cleanXml = cleanXml.split("\n").slice(1).join("\n");
        }
        if (cleanXml.endsWith("```")) {
            cleanXml = cleanXml.slice(0, -3).trim();
        }
        if (cleanXml.startsWith("xml")) {
            cleanXml = cleanXml.slice(3).trim();
        }

        const wasFixed = cleanXml !== xml;
        console.log(`Validation complete. Fixed: ${wasFixed}`);

        return new Response(
            JSON.stringify({
                xml: cleanXml,
                validated: true,
                ai_fixed: wasFixed
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Validation error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});

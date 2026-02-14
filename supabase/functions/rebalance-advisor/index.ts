import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, portfolio } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Je bent een ervaren portfolioadviseur voor dividendbeleggers. Analyseer de portefeuille en genereer een herbalanceervoorstel.

## Gebruikersvoorkeuren
- Primair doel: ${preferences.primaryGoal}
- Beleggingsstijl: ${preferences.investmentStyle}
- Risicotolerantie: ${preferences.riskTolerance}/10
- Gewenste sectoren: ${preferences.targetSectors.join(", ")}
- Gewenste regio's: ${preferences.targetRegions.join(", ")}
- Gewenste yield range: ${preferences.targetYieldMin}% - ${preferences.targetYieldMax}%

## Huidige Portefeuille
### Posities
${JSON.stringify(portfolio.positions, null, 2)}

### Sectorverdeling
${JSON.stringify(portfolio.sectorBreakdown, null, 2)}

### Asset Type Verdeling
${JSON.stringify(portfolio.assetTypeBreakdown, null, 2)}

### Regio Verdeling
${JSON.stringify(portfolio.regionBreakdown, null, 2)}

### Valuta Verdeling
${JSON.stringify(portfolio.currencyBreakdown, null, 2)}

## Instructies
Genereer een gestructureerd herbalanceervoorstel. Je MOET antwoorden als een VALID JSON object met exact deze structuur (geen markdown, geen code blocks, alleen puur JSON):

{
  "summary": "Korte samenvatting van de analyse en aanbevelingen (2-4 zinnen)",
  "riskAnalysis": {
    "overweightSectors": ["sector1 met toelichting", "sector2 met toelichting"],
    "underweightSectors": ["sector1 met toelichting"],
    "concentrationRisks": ["risico beschrijving"],
    "yieldTrapWarnings": ["waarschuwing voor ticker X met reden"],
    "correlationRisks": ["correlatie beschrijving"],
    "currencyRisks": ["valutarisico beschrijving"]
  },
  "adjustments": [
    {
      "ticker": "TICKER",
      "name": "Naam",
      "currentWeight": 5.2,
      "suggestedWeight": 4.0,
      "action": "decrease",
      "reasoning": "Korte reden"
    }
  ],
  "sectorShifts": [
    {
      "sector": "Sectornaam",
      "currentWeight": 25.0,
      "suggestedWeight": 20.0
    }
  ],
  "replacements": [
    {
      "sellTicker": "TICKER1",
      "sellReason": "Reden om te verkopen",
      "buyTicker": "TICKER2",
      "buyReason": "Reden om te kopen"
    }
  ],
  "additionalInsights": "Aanvullende observaties en aanbevelingen als tekst met bullet points"
}

Belangrijk:
- action moet een van zijn: "increase", "decrease", "hold", "sell", "new"
- Wees specifiek met percentages
- Waarschuw expliciet voor yield traps (yields >10-12%)
- Analyseer correlatie tussen posities
- Houd rekening met de gebruikersvoorkeuren
- Stel geen posities voor die al in de portefeuille zitten bij "new"
- Suggereer GEEN automatische uitvoering
- Antwoord ALLEEN met het JSON object, geen andere tekst`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Je bent een expert portfolioadviseur gespecialiseerd in dividend- en inkomensstrategieën. Je werkt met CEF's, BDC's, REIT's, ETF's, Preferreds en Baby Bonds. Antwoord ALTIJD met valid JSON. Geen markdown code blocks. Antwoord in het Nederlands.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Te veel verzoeken. Probeer het later opnieuw." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits op. Voeg credits toe in je Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error, status:", response.status);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content ?? "";

    // Strip markdown code blocks if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let proposal;
    try {
      proposal = JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON:", content.substring(0, 500));
      throw new Error("AI response was not valid JSON");
    }

    return new Response(JSON.stringify({ proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rebalance-advisor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { error: authErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payload size check
    const rawText = await req.text();
    if (rawText.length > 1_000_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try { body = JSON.parse(rawText); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { preferences, portfolio } = body;

    if (!preferences || typeof preferences !== "object" || !portfolio || typeof portfolio !== "object") {
      return new Response(JSON.stringify({ error: "Missing preferences or portfolio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(preferences.targetSectors)) preferences.targetSectors = [];
    if (!Array.isArray(preferences.targetRegions)) preferences.targetRegions = [];
    // Truncate string fields to prevent prompt injection via oversized content
    if (typeof preferences.primaryGoal === "string") preferences.primaryGoal = preferences.primaryGoal.slice(0, 200);
    if (typeof preferences.investmentStyle === "string") preferences.investmentStyle = preferences.investmentStyle.slice(0, 200);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const assetMix = preferences.assetMixTarget ?? {};
    const prompt = `Je bent een ervaren portfolioadviseur voor dividendbeleggers. Analyseer de VOLLEDIGE portefeuille (publieke beurs + private investeringen) en genereer een herbalanceervoorstel.

## Gebruikersvoorkeuren
- Primair doel: ${preferences.primaryGoal}
- Beleggingsstijl: ${preferences.investmentStyle}
- Risicotolerantie: ${preferences.riskTolerance}/10
- Gewenste sectoren: ${preferences.targetSectors.join(", ")}
- Gewenste regio's: ${preferences.targetRegions.join(", ")}
- Gewenste yield range: ${preferences.targetYieldMin}% - ${preferences.targetYieldMax}%
- Gewenste asset allocatie (doelstelling):
  * Aandelen/ETF/CEF/BDC: ${assetMix.equity ?? "?"}%
  * Credit/Obligaties/Preferreds/Baby Bonds: ${assetMix.credit ?? "?"}%
  * Vastgoed/REIT: ${assetMix.realEstate ?? "?"}%
  * Private investeringen: ${assetMix.privateAssets ?? "?"}%
  * Cash: ${assetMix.cash ?? "?"}%

## Portfolio Overzicht
- Totale portfolio waarde: €${(portfolio.totalPortfolioValue ?? 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
- Aantal portfolios: ${(portfolio.portfolios ?? []).length}
- Portfolios: ${(portfolio.portfolios ?? []).map((p: any) => `${p.name} (${p.strategy})`).join(", ")}

## Publieke Posities (beurs)
${JSON.stringify(portfolio.positions?.filter((p: any) => !p.isPrivate), null, 2)}

## Private Investeringen
${JSON.stringify(portfolio.privateInvestments ?? [], null, 2)}

### Private Metrics
- Netto eigen vermogen privaat: €${(portfolio.privateMetrics?.totalEquity ?? 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
- Jaarlijkse cashflow privaat: €${(portfolio.privateMetrics?.totalAnnualCashflow ?? 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
- Gewicht privaat in totale portfolio: ${(portfolio.privateMetrics?.privateWeightPct ?? 0).toFixed(1)}%

## Gecombineerde Breakdowns (publiek + privaat)
### Sectorverdeling
${JSON.stringify(portfolio.sectorBreakdown, null, 2)}

### Asset Type Verdeling
${JSON.stringify(portfolio.assetTypeBreakdown, null, 2)}

### Regio Verdeling
${JSON.stringify(portfolio.regionBreakdown, null, 2)}

### Valuta Verdeling
${JSON.stringify(portfolio.currencyBreakdown, null, 2)}

## Instructies
Analyseer ZOWEL de publieke als private portefeuille als een geïntegreerd geheel. Vergelijk de HUIDIGE asset allocatie met de GEWENSTE allocatie van de gebruiker en identificeer afwijkingen. Private investeringen zijn illiquide dus wees realistisch in aanbevelingen (je kunt private assets niet zomaar verkopen).

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

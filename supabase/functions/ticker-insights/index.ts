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
    const body = await req.json();
    const {
      ticker, name, assetClass, sector, industry,
      fundamentals, scores, dividendCount, rocCount,
      position, portfolioHoldings,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Analyseer de volgende ticker voor een dividendbelegger. Geef concrete, bruikbare inzichten in het Nederlands.

## Ticker Info
- Ticker: ${ticker}
- Naam: ${name || "Onbekend"}
- Asset Class: ${assetClass}
- Sector: ${sector || "Onbekend"}
- Industrie: ${industry || "Onbekend"}

## Positie
- Aantal: ${position.quantity}
- Marktwaarde: ${position.marketValue ? `$${position.marketValue.toFixed(2)}` : "Onbekend"}
- Ongerealiseerd rendement: ${position.unrealizedPnlPct ? `${position.unrealizedPnlPct.toFixed(2)}%` : "Onbekend"}

## Fundamentele Data
${fundamentals ? JSON.stringify(fundamentals, null, 2) : "Niet beschikbaar"}

## Scores (0-100)
${scores ? JSON.stringify(scores, null, 2) : "Niet beschikbaar"}

## Dividendhistorie
- Totaal uitkeringen: ${dividendCount}
- Waarvan ROC: ${rocCount} (${dividendCount > 0 ? ((rocCount / dividendCount) * 100).toFixed(1) : 0}%)

## Andere Holdings in Portfolio
${JSON.stringify(portfolioHoldings, null, 2)}

## Analyse Instructies
Geef inzichten over:

1. **Risicofactoren** — Specifieke risico's voor deze ticker (markt, sector, structureel)
2. **Dividendduurzaamheid** — Hoe houdbaar is het huidige dividend? Let op payout ratio, ROC-percentage, CAGR-trend
3. **Structurele zwaktes** — Fundamentele zorgen (hoge leverage, dalende inkomsten, etc.)
4. **Blootstellingsoverlap** — Heeft deze positie overlap met andere holdings in de portefeuille? (zelfde sector, asset class, regio)
5. **Aanvullende analyse-dimensies** — Stel specifieke metrics voor die relevant zijn voor langetermijn dividendbeleggen in dit type activa (bijv. NAV-discount voor CEFs, credit quality voor BDCs, FFO voor REITs)

Houd het beknopt (max 500 woorden). Gebruik bullet points. Wees specifiek.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Je bent een expert financieel analist gespecialiseerd in dividend- en inkomensstrategieën met CEF's, BDC's, REIT's, ETF's, Preferreds en Baby Bonds. Antwoord altijd in het Nederlands. Wees eerlijk over risico's.",
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
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const insights = result.choices?.[0]?.message?.content ?? "Geen inzichten gegenereerd.";

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ticker-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

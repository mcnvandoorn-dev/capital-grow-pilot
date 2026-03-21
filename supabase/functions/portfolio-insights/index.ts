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
    if (rawText.length > 500_000) {
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

    const { assetType, sector, region, currency, dividendVsGrowth, topPositions } = body;

    if (!assetType || typeof assetType !== "object") {
      return new Response(JSON.stringify({ error: "Missing or invalid assetType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Je bent een ervaren portfolioanalist. Analyseer de volgende portefeuilleverdeling en geef concrete, bruikbare inzichten in het Nederlands.

## Portfolio Data

### Verdeling per Asset Type
${JSON.stringify(assetType, null, 2)}

### Sectorverdeling
${JSON.stringify(sector, null, 2)}

### Geografische Spreiding
${JSON.stringify(region, null, 2)}

### Valutablootstelling
${JSON.stringify(currency, null, 2)}

### Dividend vs Groei
${JSON.stringify(dividendVsGrowth, null, 2)}

### Top Posities (gewicht)
${JSON.stringify(topPositions, null, 2)}

## Instructies
Analyseer bovenstaande data en geef inzichten over:

1. **Concentratierisico's** — Zijn er posities of asset types die een te groot deel uitmaken? (>15% voor één positie, >40% voor één asset type)
2. **Sector-onevenwichtigheden** — Is de portefeuille te eenzijdig in bepaalde sectoren? Welke sectoren ontbreken?
3. **Geografische blootstelling** — Is er voldoende diversificatie over regio's? Risico's van te veel focus op één land/regio?
4. **Valutarisico** — Welk percentage is blootgesteld aan wisselkoersrisico?
5. **Dividend vs Groei balans** — Is de verhouding gezond voor een inkomensgerichte strategie?
6. **Aanvullende aanbevelingen** — Stel andere relevante dimensies voor die de analyse kunnen verbeteren (bijv. duration, credit quality, liquiditeit, correlatie).

Houd het beknopt (max 400 woorden). Gebruik bullet points. Wees specifiek met percentages uit de data.`;

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
              "Je bent een expert portfolioanalist gespecialiseerd in dividend- en inkomensstrategieën met CEF's, BDC's, REIT's, ETF's, Preferreds en Baby Bonds. Antwoord altijd in het Nederlands.",
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
    const insights = result.choices?.[0]?.message?.content ?? "Geen inzichten gegenereerd.";

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("portfolio-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

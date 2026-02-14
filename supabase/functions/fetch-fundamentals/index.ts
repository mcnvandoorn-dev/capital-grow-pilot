import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const userId = claims.claims.sub as string;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's securities
    const { data: positions } = await serviceClient
      .from("positions")
      .select("security_id, securities(id, ticker, name, asset_class)")
      .eq("portfolios.user_id", userId);

    // Fallback: get securities via portfolios
    const { data: portfolios } = await serviceClient
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true);

    const portfolioIds = (portfolios ?? []).map((p: any) => p.id);
    if (portfolioIds.length === 0)
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { data: posData } = await serviceClient
      .from("positions")
      .select("security_id, securities(id, ticker, name, asset_class)")
      .in("portfolio_id", portfolioIds);

    const secMap = new Map<string, { ticker: string; name: string | null; asset_class: string }>();
    for (const p of posData ?? []) {
      const sec = (p as any).securities;
      if (sec && !secMap.has(sec.id)) {
        secMap.set(sec.id, { ticker: sec.ticker, name: sec.name, asset_class: sec.asset_class });
      }
    }

    if (secMap.size === 0)
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build ticker list for AI prompt
    const tickerList = [...secMap.entries()].map(
      ([id, s]) => `${s.ticker} (${s.name ?? "unknown"}, ${s.asset_class})`
    );

    const prompt = `You are a financial data analyst. For each of the following securities, provide fundamental metrics.
Return ONLY a JSON array with one object per ticker. Use null if data is unavailable.

Securities:
${tickerList.join("\n")}

For each ticker return:
{
  "ticker": "TICKER",
  "dividend_yield": number or null (current annual dividend yield as decimal, e.g. 0.12 for 12%),
  "dividend_cagr_5y": number or null (5-year dividend compound annual growth rate as decimal),
  "payout_ratio": number or null (dividend payout ratio as decimal, e.g. 0.85 for 85%),
  "pe_ratio": number or null (price to earnings ratio),
  "revenue_growth_3y": number or null (3-year revenue CAGR as decimal),
  "revenue_growth_5y": number or null (5-year revenue CAGR as decimal),
  "earnings_growth_3y": number or null (3-year earnings CAGR as decimal),
  "earnings_growth_5y": number or null (5-year earnings CAGR as decimal)
}

Important notes:
- For CEFs and BDCs, payout_ratio may exceed 1.0 if they distribute more than earnings (using leverage/ROC). This is normal.
- For CEFs, PE ratio is often not applicable - use null.
- Use the most recent available data.
- Return ONLY the JSON array, no markdown, no explanation.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a financial data provider. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429)
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (status === 402)
        return new Response(JSON.stringify({ error: "Credits required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await aiResp.json();
    let content = aiData.choices?.[0]?.message?.content ?? "";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let fundamentals: any[];
    try {
      fundamentals = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ticker-to-securityId mapping
    const tickerToId = new Map<string, string>();
    for (const [id, s] of secMap) {
      tickerToId.set(s.ticker.toUpperCase(), id);
    }

    const today = new Date().toISOString().split("T")[0];
    let updated = 0;

    for (const f of fundamentals) {
      const secId = tickerToId.get(f.ticker?.toUpperCase());
      if (!secId) continue;

      const row = {
        security_id: secId,
        data_date: today,
        dividend_yield: f.dividend_yield ?? null,
        dividend_cagr_5y: f.dividend_cagr_5y ?? null,
        payout_ratio: f.payout_ratio ?? null,
        pe_ratio: f.pe_ratio ?? null,
        revenue_growth_3y: f.revenue_growth_3y ?? null,
        revenue_growth_5y: f.revenue_growth_5y ?? null,
        earnings_growth_3y: f.earnings_growth_3y ?? null,
        earnings_growth_5y: f.earnings_growth_5y ?? null,
      };

      const { error: upsertErr } = await serviceClient
        .from("fundamental_data")
        .upsert(row, { onConflict: "security_id,data_date" });

      if (!upsertErr) updated++;
      else console.error(`Failed to upsert ${f.ticker}:`, upsertErr.message);
    }

    return new Response(
      JSON.stringify({ updated, total: fundamentals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-fundamentals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

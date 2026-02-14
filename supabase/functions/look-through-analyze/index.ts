import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SecurityInput {
  security_id: string;
  ticker: string;
  name: string | null;
  asset_class: string;
  sector: string | null;
  industry: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for shared reference data writes
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { securities } = (await req.json()) as { securities: SecurityInput[] };
    if (!securities?.length) {
      return new Response(JSON.stringify({ error: "No securities provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which securities already have fresh exposure data (< 7 days old)
    const securityIds = securities.map((s) => s.security_id);
    const { data: existing } = await supabase
      .from("issuer_exposures")
      .select("security_id, generated_at")
      .in("security_id", securityIds);

    const freshCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const freshSecurityIds = new Set(
      (existing ?? [])
        .filter((e) => e.generated_at > freshCutoff)
        .map((e) => e.security_id)
    );

    const staleSecurities = securities.filter(
      (s) => !freshSecurityIds.has(s.security_id)
    );

    if (staleSecurities.length === 0) {
      return new Response(
        JSON.stringify({ message: "All exposures are fresh", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch securities (max 10 per AI call to stay within context limits)
    const batchSize = 10;
    let totalUpdated = 0;

    for (let i = 0; i < staleSecurities.length; i += batchSize) {
      const batch = staleSecurities.slice(i, i + batchSize);
      const tickerList = batch
        .map(
          (s) =>
            `- ${s.ticker} (${s.name ?? "Unknown"}) | Asset class: ${s.asset_class} | Sector: ${s.sector ?? "Unknown"} | Industry: ${s.industry ?? "Unknown"}`
        )
        .join("\n");

      const prompt = `You are a financial analyst. For each security below, provide a detailed economic exposure breakdown.

Securities:
${tickerList}

For EACH security, return a JSON object with:
1. "revenue_segments": Array of {label, weight, sub_label} - revenue breakdown by business line (weights sum to 1.0)
2. "geographic": Array of {label, weight, sub_label} - geographic revenue exposure (weights sum to 1.0). Use country names.
3. "risk_bucket": Array of {label, weight} - classify into: Cyclical, Defensive, Financial, Commodity-linked, Rate-sensitive, Technology, Healthcare (weights sum to 1.0)
4. "capital_structure": One of: "Common Equity", "Preferred Equity", "Senior Debt", "Subordinated Debt", "Convertible"

For BDCs: revenue segments should reflect the underlying lending exposure (middle market, tech, healthcare, etc.)
For CEFs: revenue segments should reflect the underlying bond/credit exposure (CLO, high yield, investment grade, etc.)
For Preferred shares: map to the issuer's common equity exposure
For Baby Bonds: map to the issuer's common equity exposure

Return ONLY valid JSON array:
[{"ticker": "XYZ", "revenue_segments": [...], "geographic": [...], "risk_bucket": [...], "capital_structure": "..."}]

Be precise. Use real data from 10-K filings, annual reports, and public disclosures. Weights must sum to 1.0 per category.`;

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
                  "You are a financial data analyst. Return only valid JSON, no markdown, no commentary.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
          }),
        }
      );

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          console.warn("Rate limited, waiting before retry...");
          await new Promise((r) => setTimeout(r, 5000));
          i -= batchSize; // retry this batch
          continue;
        }
        if (status === 402) {
          throw new Error("AI credits exhausted");
        }
        console.error("AI request failed with status:", status);
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content ?? "";

      // Strip markdown code fences if present
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let results: any[];
      try {
        results = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse AI response");
        continue;
      }

      // Upsert exposure data
      const now = new Date().toISOString();
      for (const result of results) {
        const sec = batch.find(
          (s) => s.ticker.toUpperCase() === result.ticker?.toUpperCase()
        );
        if (!sec) continue;

        // Delete old exposures for this security
        await supabase
          .from("issuer_exposures")
          .delete()
          .eq("security_id", sec.security_id);

        const rows: any[] = [];

        // Revenue segments
        for (const seg of result.revenue_segments ?? []) {
          rows.push({
            security_id: sec.security_id,
            exposure_type: "revenue_segment",
            label: seg.label,
            sub_label: seg.sub_label || null,
            weight: Math.min(1, Math.max(0, seg.weight)),
            source: "ai",
            confidence: "medium",
            generated_at: now,
          });
        }

        // Geographic
        for (const geo of result.geographic ?? []) {
          rows.push({
            security_id: sec.security_id,
            exposure_type: "geographic",
            label: geo.label,
            sub_label: geo.sub_label || null,
            weight: Math.min(1, Math.max(0, geo.weight)),
            source: "ai",
            confidence: "medium",
            generated_at: now,
          });
        }

        // Risk buckets
        for (const rb of result.risk_bucket ?? []) {
          rows.push({
            security_id: sec.security_id,
            exposure_type: "risk_bucket",
            label: rb.label,
            sub_label: null,
            weight: Math.min(1, Math.max(0, rb.weight)),
            source: "ai",
            confidence: "medium",
            generated_at: now,
          });
        }

        // Capital structure
        if (result.capital_structure) {
          rows.push({
            security_id: sec.security_id,
            exposure_type: "capital_structure",
            label: result.capital_structure,
            sub_label: null,
            weight: 1.0,
            source: "ai",
            confidence: "high",
            generated_at: now,
          });
        }

        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("issuer_exposures")
            .upsert(rows, { onConflict: "security_id,exposure_type,label" });

          if (insertError) {
            console.error("Insert error for ticker:", insertError.message);
          } else {
            totalUpdated++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Exposure analysis complete", updated: totalUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Look-through error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

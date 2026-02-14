import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Fetch ticker info from multiple Yahoo Finance endpoints */
async function fetchTickerInfo(ticker: string): Promise<{
  name: string | null;
  sector: string | null;
  industry: string | null;
}> {
  const empty = { name: null, sector: null, industry: null };
  
  // Try Yahoo Finance v8 quote endpoint
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,assetProfile`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (res.ok) {
      const json = await res.json();
      const result = json?.quoteSummary?.result?.[0];
      const price = result?.price;
      const profile = result?.assetProfile;
      if (price?.longName || price?.shortName) {
        console.log(`Yahoo v10 OK for ${ticker}: ${price.longName || price.shortName}`);
        return {
          name: price.longName || price.shortName || null,
          sector: profile?.sector || null,
          industry: profile?.industry || null,
        };
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.log(`Yahoo v10 failed for ${ticker}:`, e);
  }

  // Fallback: Yahoo v6 quote
  try {
    const url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (res.ok) {
      const json = await res.json();
      const quote = json?.quoteResponse?.result?.[0];
      if (quote) {
        console.log(`Yahoo v6 OK for ${ticker}: ${quote.longName || quote.shortName}`);
        return {
          name: quote.longName || quote.shortName || null,
          sector: quote.sector || null,
          industry: quote.industry || null,
        };
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.log(`Yahoo v6 failed for ${ticker}:`, e);
  }

  // Fallback: use Lovable AI to look up ticker name
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (apiKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: `What is the full company/fund name for the stock ticker "${ticker}"? Reply ONLY with the name, nothing else. If unknown, reply "UNKNOWN".`,
            },
          ],
          max_tokens: 50,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const answer = json?.choices?.[0]?.message?.content?.trim();
        if (answer && answer !== "UNKNOWN" && answer.length < 100) {
          console.log(`AI lookup OK for ${ticker}: ${answer}`);
          return { name: answer, sector: null, industry: null };
        }
      } else {
        await res.text();
      }
    } catch (e) {
      console.log(`AI lookup failed for ${ticker}:`, e);
    }
  }

  console.log(`No data found for ${ticker}`);
  return empty;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT
    const anonClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(
        JSON.stringify({ error: "tickers array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate & clean tickers
    const cleanedTickers = [
      ...new Set(
        tickers
          .map((t: unknown) => String(t ?? "").trim().toUpperCase())
          .filter((t: string) => t && /^[A-Z0-9][A-Z0-9.\-]{0,19}$/.test(t))
      ),
    ];

    if (cleanedTickers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid tickers provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role for writing to securities (shared table)
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get existing securities
    const { data: existing, error: fetchErr } = await adminClient
      .from("securities")
      .select("id, ticker, name")
      .in("ticker", cleanedTickers);
    if (fetchErr) throw fetchErr;

    const existingMap = new Map(
      (existing ?? []).map((s: any) => [s.ticker, { id: s.id, name: s.name }])
    );

    // Find tickers that are missing OR have no name
    const missing = cleanedTickers.filter(
      (t: string) => !existingMap.has(t)
    );
    const needsName = cleanedTickers.filter((t: string) => {
      const e = existingMap.get(t);
      return e && !e.name;
    });

    // Fetch info from Yahoo Finance for all tickers needing data
    const tickersToEnrich = [...missing, ...needsName];
    console.log(`Enriching ${tickersToEnrich.length} tickers via Yahoo Finance`);

    const enrichedData = new Map<string, { name: string | null; sector: string | null; industry: string | null }>();
    
    // Fetch in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < tickersToEnrich.length; i += batchSize) {
      const batch = tickersToEnrich.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(t => fetchTickerInfo(t)));
      batch.forEach((t, idx) => enrichedData.set(t, results[idx]));
    }

    // Create missing securities with enriched data
    if (missing.length > 0) {
      const { data: created, error: createErr } = await adminClient
        .from("securities")
        .insert(
          missing.map((ticker: string) => {
            const info = enrichedData.get(ticker);
            return {
              ticker,
              name: info?.name || null,
              sector: info?.sector || null,
              industry: info?.industry || null,
              asset_class: "OTHER" as const,
            };
          })
        )
        .select("id, ticker");
      if (createErr) throw createErr;
      created?.forEach((s: any) => existingMap.set(s.ticker, { id: s.id, name: null }));
    }

    // Update existing securities that have no name
    for (const ticker of needsName) {
      const info = enrichedData.get(ticker);
      if (info?.name) {
        const entry = existingMap.get(ticker);
        if (entry) {
          await adminClient
            .from("securities")
            .update({
              name: info.name,
              sector: info.sector || undefined,
              industry: info.industry || undefined,
            })
            .eq("id", entry.id);
        }
      }
    }

    // Add to user's watchlist
    const { data: existingWl } = await anonClient
      .from("watchlist")
      .select("security_id")
      .eq("user_id", user.id);
    const existingWlIds = new Set(
      (existingWl ?? []).map((w: any) => w.security_id)
    );

    const toInsert = cleanedTickers
      .map((t: string) => existingMap.get(t)?.id)
      .filter(
        (id: string | undefined): id is string =>
          !!id && !existingWlIds.has(id)
      )
      .map((security_id: string) => ({
        security_id,
        user_id: user.id,
      }));

    if (toInsert.length > 0) {
      const { error: insertErr } = await anonClient
        .from("watchlist")
        .insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        added: toInsert.length,
        skipped: cleanedTickers.length - toInsert.length,
        total: cleanedTickers.length,
        enriched: tickersToEnrich.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("bulk-upsert-securities error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

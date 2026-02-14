import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known ticker → asset_class mappings for deterministic classification
const KNOWN_BDC = new Set(["ARCC","BXSL","FDUS","HTGC","MAIN","OBDC","TPVG","TSLX","GBDC","GSBD","MSDL","NCDL","PSEC","OCSL","FSK","CSWC","SLRC","NMFC","PFLT","PNNT","BCSF","CGBD","ORCC","NEWT","SAR","TCPC","BBDC","BAIN","GLAD","GAIN","AINV","HRZN","TRIN","KCNQ"]);
const KNOWN_CEF = new Set(["GOF","PCN","PDI","PTY","BME","OXLC","XFLT","MCI","MPV","ECC","RVT","ADX","RQI","RNP","JPC","JPS","JPI","HIX","HIE","UTF","USA","UTG","BTZ","BGB","AWF","ACP","BST","BIGZ","THQ","THW","EOS","EOI","ETG","ETW","ETY","ETB","JFR","JSD","DSL","FRA","FPF","DMO","NBB","NUV"]);
const KNOWN_REIT = new Set(["O","STAG","NNN","WPC","VICI","MPW","AGNC","NLY","GOOD","LAND","HASI","UNIT"]);
const KNOWN_ETF = new Set(["VTI","VOO","SPY","QQQ","SCHD","VYM","JEPI","JEPQ","DIVO","VIG","DGRO","HDV","PFF","HYG","LQD","TLT","BND","AGG","EMB","VWO","IEMG"]);

const PREF_REGEX = /\s+PR[A-Z]?$/;
const BABY_BOND_TICKERS = new Set(["OXLCG","NEWTG","ECCC","TRINL","KCNQ","OXLCL","HRZNG"]);

function classifyTicker(ticker: string, aiAssetClass?: string): { asset_class: string } {
  const t = ticker.toUpperCase();
  if (KNOWN_BDC.has(t)) return { asset_class: "BDC" };
  if (KNOWN_CEF.has(t)) return { asset_class: "CEF" };
  if (KNOWN_REIT.has(t)) return { asset_class: "REIT" };
  if (KNOWN_ETF.has(t)) return { asset_class: "ETF" };
  if (BABY_BOND_TICKERS.has(t)) return { asset_class: "BABY_BOND" };
  if (PREF_REGEX.test(t) || t.includes(" PR")) return { asset_class: "PREFERRED" };
  
  // Use AI classification if provided
  if (aiAssetClass) {
    const ac = aiAssetClass.toUpperCase();
    if (["BDC","CEF","REIT","ETF","PREFERRED","BABY_BOND"].includes(ac)) {
      return { asset_class: ac };
    }
  }
  return { asset_class: "OTHER" };
}

/** Fetch ticker info using Lovable AI (combined name + classification) */
async function fetchTickerInfo(ticker: string): Promise<{
  name: string | null;
  asset_class: string | null;
  sector: string | null;
  industry: string | null;
}> {
  const empty = { name: null, asset_class: null, sector: null, industry: null };

  // Use Lovable AI to get name, type, and sector in one call
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.log(`No LOVABLE_API_KEY, skipping enrichment for ${ticker}`);
    return empty;
  }

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
            content: `For the US-traded stock/fund ticker "${ticker}", provide this info as JSON only (no markdown):
{"name":"<full official name>","asset_class":"<one of: BDC, CEF, REIT, ETF, PREFERRED, BABY_BOND, OTHER>","sector":"<sector like Financial Services, Fixed Income, Real Estate, Technology, Energy, Healthcare, Utilities, etc>","industry":"<specific industry>"}

Rules:
- BDC = Business Development Company (e.g. ARCC, BXSL, HTGC)
- CEF = Closed-End Fund (e.g. GOF, PDI, PTY, OXLC)
- REIT = Real Estate Investment Trust
- ETF = Exchange Traded Fund
- PREFERRED = Preferred stock
- BABY_BOND = Exchange-traded debt/baby bond
- OTHER = Common stock or anything else
- If unknown ticker, set name to null
Reply ONLY with the JSON object.`,
          },
        ],
        max_tokens: 200,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const answer = json?.choices?.[0]?.message?.content?.trim();
      if (answer) {
        // Parse JSON from AI response (strip markdown fences if present)
        const cleaned = answer.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          console.log(`AI enrichment OK for ${ticker}:`, JSON.stringify(parsed));
          return {
            name: parsed.name && parsed.name !== "null" ? parsed.name : null,
            asset_class: parsed.asset_class || null,
            sector: parsed.sector || null,
            industry: parsed.industry || null,
          };
        } catch {
          // If JSON parse fails, try to extract just the name
          if (answer.length < 100 && !answer.includes("{")) {
            return { name: answer, asset_class: null, sector: null, industry: null };
          }
        }
      }
    } else {
      const errText = await res.text();
      console.log(`AI enrichment failed for ${ticker}: ${res.status} ${errText}`);
    }
  } catch (e) {
    console.log(`AI enrichment error for ${ticker}:`, e);
  }

  console.log(`No enrichment data found for ${ticker}`);
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
          .filter((t: string) => t && /^[A-Z0-9][A-Z0-9.\- ]{0,19}$/.test(t))
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
      .select("id, ticker, name, asset_class")
      .in("ticker", cleanedTickers);
    if (fetchErr) throw fetchErr;

    const existingMap = new Map(
      (existing ?? []).map((s: any) => [s.ticker, { id: s.id, name: s.name, asset_class: s.asset_class }])
    );

    // Find tickers that need enrichment (missing, no name, or still OTHER)
    const missing = cleanedTickers.filter((t: string) => !existingMap.has(t));
    const needsEnrichment = cleanedTickers.filter((t: string) => {
      const e = existingMap.get(t);
      return e && (!e.name || e.asset_class === "OTHER");
    });

    const tickersToEnrich = [...missing, ...needsEnrichment];
    console.log(`Enriching ${tickersToEnrich.length} tickers: ${tickersToEnrich.join(", ")}`);

    const enrichedData = new Map<string, { name: string | null; asset_class: string | null; sector: string | null; industry: string | null }>();

    // Fetch in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < tickersToEnrich.length; i += batchSize) {
      const batch = tickersToEnrich.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((t) => fetchTickerInfo(t)));
      batch.forEach((t, idx) => enrichedData.set(t, results[idx]));
    }

    // Create missing securities with enriched data
    if (missing.length > 0) {
      const rows = missing.map((ticker: string) => {
        const info = enrichedData.get(ticker);
        const classification = classifyTicker(ticker, info?.asset_class ?? undefined);
        return {
          ticker,
          name: info?.name || null,
          asset_class: classification.asset_class as any,
          sector: info?.sector || null,
          industry: info?.industry || null,
        };
      });

      const { data: created, error: createErr } = await adminClient
        .from("securities")
        .insert(rows)
        .select("id, ticker");
      if (createErr) throw createErr;
      created?.forEach((s: any) => existingMap.set(s.ticker, { id: s.id, name: null, asset_class: "OTHER" }));
    }

    // Update existing securities that need enrichment
    for (const ticker of needsEnrichment) {
      const info = enrichedData.get(ticker);
      const entry = existingMap.get(ticker);
      if (!entry || !info) continue;

      const classification = classifyTicker(ticker, info.asset_class ?? undefined);
      const updates: Record<string, any> = {};

      if (!entry.name && info.name) updates.name = info.name;
      if (entry.asset_class === "OTHER" && classification.asset_class !== "OTHER") {
        updates.asset_class = classification.asset_class;
      }
      if (info.sector) updates.sector = info.sector;
      if (info.industry) updates.industry = info.industry;

      if (Object.keys(updates).length > 0) {
        console.log(`Updating ${ticker}:`, JSON.stringify(updates));
        await adminClient.from("securities").update(updates).eq("id", entry.id);
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

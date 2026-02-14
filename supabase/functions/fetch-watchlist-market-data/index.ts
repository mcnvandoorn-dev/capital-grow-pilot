import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Calculate RSI from closing prices
function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Smoothed RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Fetch Yahoo Finance chart data (1 year daily)
async function fetchYahooChart(ticker: string): Promise<{
  currentPrice: number | null;
  high52w: number | null;
  low52w: number | null;
  rsi14: number | null;
  closePrices: number[];
  timestamps: number[];
} | null> {
  try {
    const yTicker = ticker.replace(/ /g, "-");
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yTicker)}?range=1y&interval=1d&includePrePost=false`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!res.ok) {
      console.log(`Yahoo chart failed for ${ticker}: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const rawTimestamps: number[] = result.timestamp ?? [];
    
    // Filter out nulls, keeping aligned arrays
    const closes: number[] = [];
    const timestamps: number[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] != null) {
        closes.push(rawCloses[i] as number);
        timestamps.push(rawTimestamps[i]);
      }
    }
    
    if (closes.length === 0) return null;
    
    const currentPrice = closes[closes.length - 1];
    const high52w = Math.max(...closes);
    const low52w = Math.min(...closes);
    const rsi14 = calculateRSI(closes, 14);
    
    return { currentPrice, high52w, low52w, rsi14, closePrices: closes, timestamps };
  } catch (e) {
    console.error(`Yahoo chart error for ${ticker}:`, e);
    return null;
  }
}

// Fetch CEF-specific data (NAV, Z-score) using Firecrawl  
async function fetchCEFData(ticker: string): Promise<{
  nav: number | null;
  zScore: number | null;
  marketPrice: number | null;
} | null> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) {
    console.log("No FIRECRAWL_API_KEY, skipping CEF data fetch");
    return null;
  }
  
  try {
    // Scrape CEFConnect for NAV and premium/discount data
    const url = `https://www.cefconnect.com/fund/${ticker}`;
    console.log(`Scraping CEFConnect for ${ticker}: ${url}`);
    
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });
    
    if (!res.ok) {
      console.log(`Firecrawl failed for ${ticker}: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    const markdown = data?.data?.markdown || data?.markdown || "";
    
    if (!markdown || markdown.length < 50) {
      console.log(`No meaningful content from CEFConnect for ${ticker}`);
      return null;
    }
    
    // Parse NAV, premium/discount and z-score from markdown
    let nav: number | null = null;
    let zScore: number | null = null;
    let marketPrice: number | null = null;
    
    // Look for NAV patterns
    const navPatterns = [
      /NAV[:\s]*\$?([\d]+\.[\d]+)/i,
      /Net Asset Value[:\s]*\$?([\d]+\.[\d]+)/i,
      /NAV Per Share[:\s]*\$?([\d]+\.[\d]+)/i,
    ];
    for (const p of navPatterns) {
      const m = markdown.match(p);
      if (m) { nav = parseFloat(m[1]); break; }
    }
    
    // Look for Z-score
    const zPatterns = [
      /Z-Score[:\s]*([-]?[\d]+\.[\d]+)/i,
      /z.score[:\s]*([-]?[\d]+\.[\d]+)/i,
      /6.Month Z-Stat[:\s]*([-]?[\d]+\.[\d]+)/i,
    ];
    for (const p of zPatterns) {
      const m = markdown.match(p);
      if (m) { zScore = parseFloat(m[1]); break; }
    }
    
    // Look for market price
    const pricePatterns = [
      /Market Price[:\s]*\$?([\d]+\.[\d]+)/i,
      /Price[:\s]*\$?([\d]+\.[\d]+)/i,
    ];
    for (const p of pricePatterns) {
      const m = markdown.match(p);
      if (m) { marketPrice = parseFloat(m[1]); break; }
    }
    
    console.log(`CEFConnect data for ${ticker}: NAV=${nav}, Z=${zScore}, Price=${marketPrice}`);
    return { nav, zScore, marketPrice };
  } catch (e) {
    console.error(`CEFConnect fetch error for ${ticker}:`, e);
    return null;
  }
}

// Use AI to fetch NAV/Z-Score for CEFs or BDCs
async function fetchNavZScoreAI(ticker: string, assetClass: string): Promise<{
  nav: number | null;
  zScore: number | null;
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  
  const typeLabel = assetClass === "BDC" ? "Business Development Company (BDC)" : "closed-end fund (CEF)";
  
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `What is the current NAV (Net Asset Value per share) and 6-month Z-Score (price vs NAV discount z-statistic) for the ${typeLabel} "${ticker}"?
For BDCs, NAV is typically reported quarterly. Use the most recent known NAV per share.
Z-Score measures how many standard deviations the current premium/discount is from the 6-month average.
Reply ONLY with JSON: {"nav": <number or null>, "z_score": <number or null>}
If you don't know the exact current values, provide your best estimate based on recent data. Reply only JSON, no markdown.`,
        }],
        max_tokens: 100,
      }),
    });
    
    if (!res.ok) return null;
    
    const json = await res.json();
    const answer = json?.choices?.[0]?.message?.content?.trim();
    if (!answer) return null;
    
    const cleaned = answer.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log(`AI ${assetClass} data for ${ticker}:`, JSON.stringify(parsed));
    return {
      nav: typeof parsed.nav === "number" ? parsed.nav : null,
      zScore: typeof parsed.z_score === "number" ? parsed.z_score : null,
    };
  } catch (e) {
    console.log(`AI ${assetClass} data error for ${ticker}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const anonClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's watchlist securities
    const { data: watchlistItems } = await anonClient
      .from("watchlist")
      .select("security_id, securities(id, ticker, asset_class)")
      .eq("user_id", user.id);

    if (!watchlistItems || watchlistItems.length === 0) {
      return new Response(JSON.stringify({ updated: 0, message: "No watchlist items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const today = new Date().toISOString().split("T")[0];
    let updated = 0;
    const errors: string[] = [];

    // Process securities in batches of 3
    const items = watchlistItems.map((w: any) => w.securities).filter(Boolean);
    
    for (let i = 0; i < items.length; i += 3) {
      const batch = items.slice(i, i + 3);
      
      const results = await Promise.all(batch.map(async (sec: any) => {
        const ticker = sec.ticker;
        const isCEF = sec.asset_class === "CEF";
        const isBDC = sec.asset_class === "BDC";
        
        console.log(`Processing ${ticker} (${sec.asset_class})...`);
        
        // Fetch Yahoo data for all tickers
        const yahoo = await fetchYahooChart(ticker);
        
        // Fetch NAV/Z-Score for CEFs and BDCs
        let navData: { nav: number | null; zScore: number | null; marketPrice?: number | null } | null = null;
        if (isCEF) {
          navData = await fetchCEFData(ticker);
          if (!navData?.nav && !navData?.zScore) {
            const aiData = await fetchNavZScoreAI(ticker, "CEF");
            if (aiData) {
              navData = { ...navData, ...aiData };
            }
          }
        } else if (isBDC) {
          // BDCs: use AI to get NAV and Z-Score
          const aiData = await fetchNavZScoreAI(ticker, "BDC");
          if (aiData) {
            navData = { nav: aiData.nav, zScore: aiData.zScore };
          }
        }
        
        return { sec, yahoo, cefData: navData };
      }));
      
      // Upsert results
      for (const { sec, yahoo, cefData } of results) {
        if (!yahoo && !cefData) {
          errors.push(`No data for ${sec.ticker}`);
          continue;
        }
        
        // Store historical daily data from Yahoo for 52w H/L calculation
        if (yahoo && yahoo.closePrices.length > 0 && yahoo.timestamps) {
          const historicalRows = yahoo.timestamps.map((ts: number, idx: number) => {
            const date = new Date(ts * 1000).toISOString().split("T")[0];
            return {
              security_id: sec.id,
              data_date: date,
              close_price: yahoo.closePrices[idx],
              market_price: yahoo.closePrices[idx],
            };
          }).filter((r: any) => r.close_price != null);
          
          // Batch upsert historical data (in chunks of 100)
          for (let h = 0; h < historicalRows.length; h += 100) {
            const chunk = historicalRows.slice(h, h + 100);
            await adminClient
              .from("market_data")
              .upsert(chunk, { onConflict: "security_id,data_date", ignoreDuplicates: false });
          }
          console.log(`Stored ${historicalRows.length} historical rows for ${sec.ticker}`);
        }
        
        // Update today's row with RSI and CEF data
        const todayRow: Record<string, any> = {
          security_id: sec.id,
          data_date: today,
          updated_at: new Date().toISOString(),
        };
        
        if (yahoo) {
          todayRow.close_price = yahoo.currentPrice;
          todayRow.market_price = yahoo.currentPrice;
          todayRow.rsi_14 = yahoo.rsi14 != null ? Math.round(yahoo.rsi14 * 100) / 100 : null;
        }
        
        if (cefData) {
          if (cefData.nav != null) todayRow.nav = cefData.nav;
          if (cefData.zScore != null) todayRow.z_score = cefData.zScore;
          if (cefData.marketPrice != null) todayRow.market_price = cefData.marketPrice;
        }
        
        await adminClient
          .from("market_data")
          .upsert(todayRow, { onConflict: "security_id,data_date" });
        
        updated++;
        console.log(`Updated ${sec.ticker}: price=${todayRow.close_price}, NAV=${todayRow.nav}, RSI=${todayRow.rsi_14}, Z=${todayRow.z_score}`);
      }
    }

    return new Response(
      JSON.stringify({ updated, errors, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-watchlist-market-data error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

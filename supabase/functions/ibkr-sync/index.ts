import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IBKR_SEND_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
const IBKR_GET_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";

// Simple XML tag extractor (no external dep)
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAttributes(xml: string, tag: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const re = new RegExp(`<${tag}\\s+([^>]+)/?>`, "gi");
  let match;
  while ((match = re.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(match[1])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    results.push(attrs);
  }
  return results;
}

async function requestFlexReport(token: string, queryId: string): Promise<string> {
  const url = `${IBKR_SEND_URL}?t=${token}&q=${queryId}&v=3`;
  const res = await fetch(url);
  const xml = await res.text();

  const status = extractTag(xml, "Status");
  if (status !== "Success") {
    const errMsg = extractTag(xml, "ErrorMessage") || "Unknown error";
    throw new Error(`IBKR SendRequest failed: ${errMsg}`);
  }

  const refCode = extractTag(xml, "ReferenceCode");
  if (!refCode) throw new Error("No ReferenceCode in IBKR response");
  return refCode;
}

async function fetchFlexStatement(
  token: string,
  refCode: string,
  maxRetries = 20
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const url = `${IBKR_GET_URL}?q=${refCode}&t=${token}&v=3`;
    console.log(`Attempt ${i + 1}/${maxRetries} to fetch IBKR report...`);
    const res = await fetch(url);
    const xml = await res.text();

    const status = extractTag(xml, "Status");
    if (status === "Warn") {
      console.log("Report not ready yet, retrying...");
      continue;
    }
    if (status === "Fail") {
      const errMsg = extractTag(xml, "ErrorMessage") || "Unknown";
      throw new Error(`IBKR GetStatement failed: ${errMsg}`);
    }
    if (xml.includes("<FlexQueryResponse") || xml.includes("<FlexStatement")) {
      console.log("Report received successfully");
      return xml;
    }
  }
  // Return null instead of throwing - caller handles retry
  return null;
}

function parseNum(v: string | undefined): number {
  if (!v || v === "") return 0;
  return parseFloat(v) || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // Payload size check
    const rawText = await req.text();
    if (rawText.length > 10_000) {
      return new Response(JSON.stringify({ success: false, error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let reqBody: any;
    try { reqBody = JSON.parse(rawText); } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { connectionId, refCode: existingRefCode, queryIdOverride } = reqBody;
    if (!connectionId || typeof connectionId !== "string") throw new Error("Missing or invalid connectionId");
    if (existingRefCode && typeof existingRefCode !== "string") throw new Error("Invalid refCode");
    if (queryIdOverride && typeof queryIdOverride !== "string") throw new Error("Invalid queryIdOverride");

    // Get IBKR connection
    const { data: conn, error: connErr } = await supabase
      .from("ibkr_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) throw new Error("IBKR connection not found");

    // Use connection values, fall back to environment secrets
    const flexToken = conn.flex_token || Deno.env.get("IBKR_FLEX_TOKEN");
    const flexQueryId = conn.flex_query_id || Deno.env.get("IBKR_QUERY_ID");
    if (!flexToken || !flexQueryId)
      throw new Error("Flex token or query ID not configured");

    // Update connection status
    await supabase
      .from("ibkr_connections")
      .update({ sync_status: "syncing" })
      .eq("id", conn.id);

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let syncLog: any = null;

    try {
      // Step 1: Request report (or reuse existing refCode)
      let refCode: string;
      if (existingRefCode) {
        console.log("Reusing existing refCode");
        refCode = existingRefCode;
      } else {
        const effectiveQueryId = queryIdOverride || flexQueryId;
        console.log("Using query ID:", queryIdOverride ? "(override)" : "(from " + (conn.flex_query_id ? "connection" : "env secret") + ")");
        refCode = await requestFlexReport(flexToken, effectiveQueryId);
        console.log("New refCode received");
      }

      // Step 2: Fetch report XML (returns null if not ready)
      const xml = await fetchFlexStatement(flexToken, refCode);
      
      if (!xml) {
        // Report not ready yet - return refCode so client can retry
        console.log("Report not ready, returning refCode for retry");
        await supabase
          .from("ibkr_connections")
          .update({ sync_status: "syncing" })
          .eq("id", conn.id);
        
        return new Response(
          JSON.stringify({ success: true, status: "pending", refCode }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Report received, length:", xml.length);

      // Create sync log now that we have data to process
      const { data: syncLogData } = await supabase
        .from("sync_logs")
        .insert({
          user_id: user.id,
          ibkr_connection_id: conn.id,
          sync_source: "FLEX_QUERY",
          status: "running",
        })
        .select()
        .single();
      syncLog = syncLogData;

      // Extract only the LAST FlexStatement (most recent date) for positions
      const lastStatementIdx = xml.lastIndexOf("<FlexStatement ");
      const lastStatementXml = lastStatementIdx >= 0 ? xml.substring(lastStatementIdx) : xml;
      console.log("Last statement XML length:", lastStatementXml.length);

      // Detect the base currency of the last FlexStatement
      const stmtAttrs = extractAttributes(lastStatementXml, "FlexStatement");
      const statementBaseCurrency = stmtAttrs.length > 0 ? stmtAttrs[0].baseCurrency : null;

      // ─── STEP 3: POSITIONS FIRST (most critical) ───
      const openPositions = extractAttributes(lastStatementXml, "OpenPosition");
      console.log("Open positions found:", openPositions.length);

      if (openPositions.length > 0) {
        const posAgg = new Map<string, {
          symbol: string; description: string | null; conid: string | null;
          exchange: string | null; currency: string; assetCategory: string | undefined;
          isin: string | null; accountId: string | null;
          totalQty: number; totalCost: number; weightedPrice: number;
        }>();

        const fxRatesMap = new Map<string, number>();
        const allStatements = extractAttributes(xml, "FlexStatement");
        const accountBaseCurrencyMap = new Map<string, string>();
        for (const stmt of allStatements) {
          if (stmt.accountId && stmt.baseCurrency) {
            accountBaseCurrencyMap.set(stmt.accountId, stmt.baseCurrency);
          }
        }

        for (const op of openPositions) {
          if (!op.symbol) continue;
          const qty = parseNum(op.position || op.quantity);
          if (qty <= 0) continue;

          const accountBase = accountBaseCurrencyMap.get(op.accountId || "") || statementBaseCurrency;
          const fxRate = parseNum(op.fxRateToBase);
          if (fxRate > 0 && op.currency && accountBase === "EUR") {
            fxRatesMap.set(op.currency, fxRate);
          }

          const key = `${op.symbol}|${op.accountId || ""}`;
          const existing = posAgg.get(key);
          const mark = parseNum(op.markPrice);

          // IBKR uses various field names for cost basis depending on Flex Query config
          let cost = parseNum(op.costBasisMoney);
          if (cost === 0) cost = parseNum(op.costBasisPrice) * qty;
          if (cost === 0) cost = parseNum(op.costPrice) * qty;
          if (cost === 0) cost = parseNum(op.openPrice) * qty;

          if (existing) {
            existing.totalQty += qty;
            existing.totalCost += cost;
            existing.weightedPrice += mark * qty;
          } else {
            posAgg.set(key, {
              symbol: op.symbol, description: op.description || null,
              conid: op.conid || null, exchange: op.listingExchange || op.exchange || null,
              currency: op.currency || "USD", assetCategory: op.assetCategory,
              isin: op.isin || null, accountId: op.accountId || null,
              totalQty: qty, totalCost: cost, weightedPrice: mark * qty,
            });
          }
        }

        // Store FX rates
        const today = new Date().toISOString().split("T")[0];
        for (const [currency, rate] of fxRatesMap) {
          if (currency === "EUR") continue;
          await supabase.from("fx_rates").upsert(
            { from_currency: currency as any, to_currency: "EUR" as any, rate: Math.round(rate * 1000000) / 1000000, rate_date: today, source: "IBKR" },
            { onConflict: "from_currency,to_currency,rate_date" }
          );
        }

        if (!fxRatesMap.has("USD")) {
          try {
            const fxRes = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
            if (fxRes.ok) {
              const fxJson = await fxRes.json();
              const usdToEur = fxJson.rates?.EUR;
              if (usdToEur && typeof usdToEur === "number") {
                await supabase.from("fx_rates").upsert(
                  { from_currency: "USD" as any, to_currency: "EUR" as any, rate: Math.round(usdToEur * 1000000) / 1000000, rate_date: today, source: "FRANKFURTER" },
                  { onConflict: "from_currency,to_currency,rate_date" }
                );
                fxRatesMap.set("USD", usdToEur);
              }
            }
          } catch { console.warn("Could not fetch USD→EUR rate"); }
        }

        // Log first position's available fields for debugging
        if (openPositions.length > 0) {
          const sample = openPositions[0];
          console.log("Sample OpenPosition fields:", Object.keys(sample).join(", "));
          console.log("Sample cost fields:", JSON.stringify({
            costBasisMoney: sample.costBasisMoney,
            costBasisPrice: sample.costBasisPrice,
            costPrice: sample.costPrice,
            openPrice: sample.openPrice,
            markPrice: sample.markPrice,
            position: sample.position,
            quantity: sample.quantity,
          }));
        }

        console.log("Aggregated to unique positions:", posAgg.size);
        recordsProcessed += openPositions.length;

        for (const [, agg] of posAgg) {
          const assetClass = mapAssetClass(agg.assetCategory, agg.description, agg.symbol);
          const sectorInfo = mapSectorIndustry(agg.symbol, assetClass);
          const { data: sec } = await supabase
            .from("securities")
            .upsert({
              ticker: agg.symbol, name: agg.description, conid: agg.conid,
              exchange: agg.exchange, currency: agg.currency as any,
              asset_class: assetClass, isin: agg.isin,
              ...(sectorInfo ? { sector: sectorInfo.sector, industry: sectorInfo.industry } : {}),
            }, { onConflict: "ticker,exchange" })
            .select("id").single();

          if (!sec) continue;

          const portfolioId = await getOrCreatePortfolio(supabase, user.id, conn.id, agg.accountId, agg.currency);
          const avgCost = agg.totalQty > 0 ? Math.round((agg.totalCost / agg.totalQty) * 10000) / 10000 : 0;
          const markPrice = agg.totalQty > 0 ? agg.weightedPrice / agg.totalQty : 0;

          const { data: existingPos } = await supabase
            .from("positions").select("id")
            .eq("portfolio_id", portfolioId).eq("security_id", sec.id).maybeSingle();

          const posData = {
            quantity: agg.totalQty,
            avg_cost_basis: avgCost,
            total_cost_basis: Math.round(agg.totalCost * 100) / 100,
            last_updated: new Date().toISOString(),
          };

          if (existingPos) {
            await supabase.from("positions").update(posData).eq("id", existingPos.id);
            recordsUpdated++;
          } else {
            await supabase.from("positions").insert({
              portfolio_id: portfolioId, security_id: sec.id,
              currency: agg.currency as any, ...posData,
            });
            recordsCreated++;
          }

          if (markPrice > 0) {
            const today = new Date().toISOString().split("T")[0];
            await supabase.from("market_data").upsert(
              { security_id: sec.id, data_date: today, close_price: Math.round(markPrice * 10000) / 10000, market_price: Math.round(markPrice * 10000) / 10000 },
              { onConflict: "security_id,data_date" }
            );
          }
        }
      }

      console.log(`Positions done: ${recordsCreated} created, ${recordsUpdated} updated`);

      // ─── STEP 4: ACCOUNT SUMMARY ───
      const equitySummary = extractAttributes(lastStatementXml, "EquitySummaryByReportDateInBase");
      if (equitySummary.length > 0) {
        const latest = equitySummary[equitySummary.length - 1];
        const nlv = parseNum(latest.totalLong) + parseNum(latest.totalShort);
        const cash = parseNum(latest.cash);
        const summaryDate = latest.reportDate ? formatDate(latest.reportDate) : new Date().toISOString().split("T")[0];

        if (nlv > 0) {
          await supabase.from("daily_account_summary").upsert(
            { user_id: user.id, date: summaryDate, net_liquidation: nlv, cash_balance: cash },
            { onConflict: "user_id,date" }
          );
        }
      }

      // ─── STEP 5: DIVIDENDS ───
      const cashTxns = extractAttributes(xml, "CashTransaction");
      for (const ct of cashTxns) {
        const ctType = (ct.type || "").toLowerCase();
        if (!ctType.includes("dividend") && !ctType.includes("payment in lieu")) continue;
        recordsProcessed++;
        if (!ct.symbol || !ct.dateTime) continue;

        const { data: sec } = await supabase
          .from("securities").select("id").eq("ticker", ct.symbol).maybeSingle();
        if (!sec) continue;

        const portfolioId = await getOrCreatePortfolio(supabase, user.id, conn.id, ct.accountId || null, (ct.currency as any) || "USD");
        const amount = parseNum(ct.amount);
        const tax = parseNum(ct.tax);
        const fxRate = parseNum(ct.fxRateToBase) || 1;
        const isRoc = ctType.includes("return of capital");
        const exDate = formatDate(ct.reportDate || ct.dateTime);

        const { data: existingDiv } = await supabase
          .from("dividend_history").select("id")
          .eq("security_id", sec.id).eq("portfolio_id", portfolioId).eq("ex_date", exDate).maybeSingle();
        if (existingDiv) { recordsUpdated++; continue; }

        const totalAmount = Math.abs(amount);
        const withholdingTax = Math.abs(tax);

        await supabase.from("dividend_history").insert({
          portfolio_id: portfolioId, security_id: sec.id, ex_date: exDate,
          total_amount: totalAmount, withholding_tax: withholdingTax,
          net_amount: totalAmount - withholdingTax, amount_per_share: 0,
          currency: (ct.currency as any) || "USD", fx_rate_to_base: fxRate,
          is_roc: isRoc, sync_source: "FLEX_QUERY",
        });
        recordsCreated++;
      }

      console.log(`Dividends done. Total created: ${recordsCreated}`);

      // ─── STEP 6: TRADES (batch-check existing) ───
      const trades = extractAttributes(xml, "Trade");
      // Pre-fetch existing trade IDs to avoid N+1 queries
      const ibkrTradeIds = trades.map(t => t.tradeID).filter(Boolean);
      const existingTradeIds = new Set<string>();
      if (ibkrTradeIds.length > 0) {
        // Fetch in batches of 500
        for (let i = 0; i < ibkrTradeIds.length; i += 500) {
          const batch = ibkrTradeIds.slice(i, i + 500);
          const { data: existing } = await supabase
            .from("transactions").select("ibkr_trade_id")
            .in("ibkr_trade_id", batch);
          if (existing) existing.forEach((e: any) => existingTradeIds.add(e.ibkr_trade_id));
        }
      }
      console.log(`Pre-fetched ${existingTradeIds.size} existing trade IDs`);

      for (const t of trades) {
        recordsProcessed++;
        if (!t.symbol || !t.tradeDate) continue;
        if (t.tradeID && existingTradeIds.has(t.tradeID)) { recordsUpdated++; continue; }

        const assetClass = mapAssetClass(t.assetCategory, t.description, t.symbol);
        const sectorInfo = mapSectorIndustry(t.symbol, assetClass);
        const { data: sec } = await supabase
          .from("securities").upsert({
            ticker: t.symbol, name: t.description || null, conid: t.conid || null,
            exchange: t.listingExchange || t.exchange || null,
            currency: (t.currency as any) || "USD", asset_class: assetClass,
            isin: t.isin || null,
            ...(sectorInfo ? { sector: sectorInfo.sector, industry: sectorInfo.industry } : {}),
          }, { onConflict: "ticker,exchange" })
          .select("id").single();

        if (!sec) continue;

        const portfolioId = await getOrCreatePortfolio(supabase, user.id, conn.id, t.accountId || null, (t.currency as any) || "USD");
        const qty = parseNum(t.quantity);
        const price = parseNum(t.tradePrice || t.price);
        const commission = parseNum(t.ibCommission || t.commission);
        const grossAmount = parseNum(t.proceeds || String(qty * price));
        const netAmount = grossAmount + commission;
        const fxRate = parseNum(t.fxRateToBase) || 1;
        const txType = qty > 0 ? "BUY" : "SELL";

        const { error: txErr } = await supabase.from("transactions").insert({
          portfolio_id: portfolioId, security_id: sec.id,
          transaction_type: txType, trade_date: formatDate(t.tradeDate),
          settlement_date: t.settleDateTarget ? formatDate(t.settleDateTarget) : null,
          quantity: Math.abs(qty), price: Math.abs(price),
          commission: Math.abs(commission), gross_amount: Math.abs(grossAmount),
          net_amount: Math.abs(netAmount), currency: (t.currency as any) || "USD",
          fx_rate_to_base: fxRate, ibkr_trade_id: t.tradeID || null,
          sync_source: "FLEX_QUERY",
        });
        if (!txErr) recordsCreated++;
      }

      // Step 7: If no open positions were found, recalculate from transactions
      if (openPositions.length === 0) {
        await recalculatePositions(supabase, user.id);
      }

      // Step 8: Backfill cost basis from transactions for positions that have 0 cost
      if (openPositions.length > 0) {
        await backfillCostBasisFromTransactions(supabase, user.id);
      }

      // Update sync log as success
      if (syncLog) {
        await supabase
          .from("sync_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            records_processed: recordsProcessed,
            records_created: recordsCreated,
            records_updated: recordsUpdated,
          })
          .eq("id", syncLog.id);
      }

      await supabase
        .from("ibkr_connections")
        .update({
          sync_status: "idle",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", conn.id);

      return new Response(
        JSON.stringify({
          success: true,
          records_processed: recordsProcessed,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncError: any) {
      // Update sync log as failed
      if (syncLog) {
        await supabase
          .from("sync_logs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: syncError.message,
            records_processed: recordsProcessed,
            records_created: recordsCreated,
          })
          .eq("id", syncLog.id);
      }

      await supabase
        .from("ibkr_connections")
        .update({ sync_status: "error" })
        .eq("id", conn.id);

      throw syncError;
    }
  } catch (error: any) {
    console.error("IBKR sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helpers

function formatDate(d: string): string {
  // IBKR format: YYYYMMDD or YYYY-MM-DD or YYYYMMDD;HHmmss
  const clean = d.split(";")[0].replace(/-/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return d;
}

// Known tickers for asset class detection
const KNOWN_BDCS = new Set([
  "ARCC","BXSL","CSWC","FDUS","GLAD","HTGC","MSDL","NCDL","OBDC","TPVG","TSLX",
  "MAIN","PSEC","GBDC","OCSL","ORCC","GSBD","FSK","GAIN","NEWT","SLRC","TCPC",
  "BBDC","PFLT","SAR","SCM","CCAP","CGBD","NMFC","PNNT","TRIN","MRCC",
]);
const KNOWN_CEFS = new Set([
  "DSU","ECC","EIC","FSCO","KIO","MCI","MPV","OXLC","PTY","XFLT","PDI",
  "GOF","AWP","UTF","USA","RQI","RNP","JPC","JPS","JRI","HYT","BGT","BTZ",
  "BST","BIGZ","CII","EOI","ETJ","EVV","FFC","HIO","HIX","IVH","JFR","KYN",
  "MHI","NAD","NRK","NUV","NZF","PHK","PML","RFI","RVT","THQ","THW","UTG",
]);
const KNOWN_BABY_BONDS = new Set([
  "ATHS","BIPH","AFGE","KMPB","NEWTG","OXLCG","ADAMO",
  "APTS","ATLCL","CSWCZ","ECCB","ECCF","ECCV","ECCW","ECCX","GDV PRK",
  "NEWTI","OXLCN","OXLCO","RILYM","RILYN","RILYO","RILYP","OXSQ",
]);

// Sector/industry mapping for known tickers and asset classes
const TICKER_SECTOR_MAP: Record<string, { sector: string; industry: string }> = {
  // BDCs
  ARCC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  BXSL: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  CSWC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  FDUS: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  GLAD: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  HTGC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  MSDL: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  NCDL: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  OBDC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  TPVG: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  TSLX: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  MAIN: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  PSEC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  GBDC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  NEWT: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  // CEFs - CLO/Structured Credit
  ECC: { sector: "Fixed Income", industry: "CLO & Structured Credit" },
  EIC: { sector: "Fixed Income", industry: "CLO & Structured Credit" },
  XFLT: { sector: "Fixed Income", industry: "CLO & Structured Credit" },
  OXLC: { sector: "Fixed Income", industry: "CLO & Structured Credit" },
  // CEFs - Multi-Sector Credit
  DSU: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  FSCO: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  KIO: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  PDI: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  PTY: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  // CEFs - Corporate Credit
  MCI: { sector: "Fixed Income", industry: "Corporate Credit" },
  MPV: { sector: "Fixed Income", industry: "Corporate Credit" },
  // Preferred - by issuer
  "CODI PRC": { sector: "Industrials", industry: "Diversified Holdings" },
  "DX PRC": { sector: "Real Estate", industry: "Mortgage REIT" },
  "IIPR PRA": { sector: "Real Estate", industry: "Specialty REIT" },
  RWTQ: { sector: "Financial Services", industry: "Mortgage Finance" },
  "TEN PRF": { sector: "Energy", industry: "Marine Transportation" },
  "ECC PRD": { sector: "Fixed Income", industry: "CLO & Structured Credit" },
  // Baby Bonds - by issuer
  ADAMO: { sector: "Financial Services", industry: "Asset Management" },
  AFGE: { sector: "Financial Services", industry: "Insurance" },
  ATHS: { sector: "Financial Services", industry: "Insurance" },
  BIPH: { sector: "Utilities", industry: "Infrastructure" },
  KMPB: { sector: "Financial Services", industry: "Insurance" },
  NEWTG: { sector: "Financial Services", industry: "Small Business Lending" },
  OXLCG: { sector: "Fixed Income", industry: "CLO & Structured Credit" },
};

// Default sector by asset class (fallback)
const ASSET_CLASS_DEFAULT_SECTOR: Record<string, { sector: string; industry: string }> = {
  BDC: { sector: "Financial Services", industry: "Asset Management & Direct Lending" },
  CEF: { sector: "Fixed Income", industry: "Multi-Sector Credit" },
  REIT: { sector: "Real Estate", industry: "Diversified REIT" },
  ETF: { sector: "Diversified", industry: "Exchange-Traded Fund" },
  PREFERRED: { sector: "Financial Services", industry: "Preferred Securities" },
  BABY_BOND: { sector: "Financial Services", industry: "Fixed Income Securities" },
};

function mapSectorIndustry(ticker: string, assetClass: string): { sector: string; industry: string } | null {
  // 1. Exact ticker match
  const upper = ticker.toUpperCase();
  if (TICKER_SECTOR_MAP[upper]) return TICKER_SECTOR_MAP[upper];
  // 2. Base ticker match (for prefs like "ECC PRD" → check "ECC")
  const base = upper.split(" ")[0];
  if (TICKER_SECTOR_MAP[base]) return TICKER_SECTOR_MAP[base];
  // 3. Asset class default
  if (ASSET_CLASS_DEFAULT_SECTOR[assetClass]) return ASSET_CLASS_DEFAULT_SECTOR[assetClass];
  return null;
}

function mapAssetClass(
  ibkrClass: string | undefined,
  description?: string | null,
  ticker?: string | null,
): "CEF" | "BDC" | "REIT" | "ETF" | "PREFERRED" | "BABY_BOND" | "OTHER" {
  // 1. Check known tickers first (most reliable)
  const baseTicker = (ticker || "").split(" ")[0].toUpperCase();
  if (KNOWN_BDCS.has(baseTicker) || KNOWN_BDCS.has(ticker?.toUpperCase() || "")) return "BDC";
  if (KNOWN_CEFS.has(baseTicker) || KNOWN_CEFS.has(ticker?.toUpperCase() || "")) return "CEF";
  if (KNOWN_BABY_BONDS.has(baseTicker) || KNOWN_BABY_BONDS.has(ticker?.toUpperCase() || "")) return "BABY_BOND";

  // 2. Description-based detection
  if (description) {
    const d = description.toUpperCase();
    if (d.includes("REAL ESTATE") || d.includes("REIT")) return "REIT";
    if (d.includes("BDC") || d.includes("BUSINESS DEVELOPMENT")) return "BDC";
    if (d.includes("PREFERRED") || d.includes("PFD") || d.includes("PFD SER")) return "PREFERRED";
    if (d.includes("BABY BOND") || d.includes("FIXED RATE") || d.includes("NOTES DUE")) return "BABY_BOND";
    if (d.includes("SPLIT CORP") || d.includes("CLOSED-END") || d.includes("CLOSED END")) return "CEF";
    if (d.includes("DIRECT LEND") || d.includes("SECURED LENDING") || d.includes("SPECIALTY LEND") || 
        d.includes("CAPITAL CORP") || d.includes("INVESTMENT CORP") || d.includes("CREDIT CO")) return "BDC";
    if (d.includes("INCOME FUND") || d.includes("INCOME OPP") || d.includes("CREDIT FUND") ||
        d.includes("DEBT STRATEGIES") || d.includes("FLTNG RT")) return "CEF";
    if (d.includes("ETF") || d.includes("TRUST UNITS")) return "ETF";
  }

  // 3. Ticker pattern: " PR" suffix often = preferred
  if (ticker && /\s+PR[A-Z]?$/.test(ticker.toUpperCase())) return "PREFERRED";

  // 4. Fallback to IBKR asset category
  if (!ibkrClass) return "OTHER";
  const c = ibkrClass.toUpperCase();
  if (c.includes("ETF") || c.includes("FUND")) return "ETF";
  return "OTHER";
}

async function getOrCreatePortfolio(
  supabase: any,
  userId: string,
  connectionId: string,
  accountId: string | null,
  currency: string
): Promise<string> {
  // Try to find existing portfolio for this IBKR connection
  const query = supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("ibkr_connection_id", connectionId);

  if (accountId) {
    query.eq("ibkr_account_id", accountId);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;

  // Create new portfolio
  const { data: newPortfolio } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      ibkr_connection_id: connectionId,
      ibkr_account_id: accountId,
      name: accountId ? `IBKR ${accountId}` : "IBKR Portfolio",
      base_currency: currency,
    })
    .select("id")
    .single();

  return newPortfolio!.id;
}

async function recalculatePositions(supabase: any, userId: string) {
async function backfillCostBasisFromTransactions(supabase: any, userId: string) {
  // Find positions with 0 cost basis
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!portfolios || portfolios.length === 0) return;

  const portfolioIds = portfolios.map((p: any) => p.id);

  const { data: zeroCostPositions } = await supabase
    .from("positions")
    .select("id, portfolio_id, security_id, quantity")
    .in("portfolio_id", portfolioIds)
    .eq("total_cost_basis", 0)
    .gt("quantity", 0);

  if (!zeroCostPositions || zeroCostPositions.length === 0) {
    console.log("No zero-cost positions to backfill");
    return;
  }

  console.log(`Backfilling cost basis for ${zeroCostPositions.length} positions from transactions`);

  for (const pos of zeroCostPositions) {
    const { data: txns } = await supabase
      .from("transactions")
      .select("transaction_type, quantity, price, commission")
      .eq("portfolio_id", pos.portfolio_id)
      .eq("security_id", pos.security_id)
      .in("transaction_type", ["BUY", "SELL"])
      .order("trade_date", { ascending: true });

    if (!txns || txns.length === 0) continue;

    // Reconstruct cost basis using average cost method
    let qty = 0;
    let totalCost = 0;

    for (const tx of txns) {
      if (tx.transaction_type === "BUY") {
        qty += tx.quantity;
        totalCost += tx.quantity * tx.price + Math.abs(tx.commission || 0);
      } else {
        const avgCostPerUnit = qty > 0 ? totalCost / qty : 0;
        qty = Math.max(0, qty - tx.quantity);
        totalCost = qty * avgCostPerUnit;
      }
    }

    if (qty <= 0 || totalCost <= 0) continue;

    // Only update if reconstructed qty roughly matches actual position
    const qtyDiff = Math.abs(qty - pos.quantity);
    const tolerance = Math.max(0.01, pos.quantity * 0.02); // 2% tolerance for DRIP fractional shares

    if (qtyDiff <= tolerance) {
      const avgCost = Math.round((totalCost / qty) * 10000) / 10000;
      const roundedTotal = Math.round(totalCost * 100) / 100;

      await supabase
        .from("positions")
        .update({ avg_cost_basis: avgCost, total_cost_basis: roundedTotal })
        .eq("id", pos.id);

      console.log(`Backfilled ${pos.security_id}: avgCost=${avgCost}, total=${roundedTotal} (txQty=${qty.toFixed(2)}, posQty=${pos.quantity})`);
    } else {
      console.log(`Skipped ${pos.security_id}: txQty=${qty.toFixed(2)} vs posQty=${pos.quantity} (diff=${qtyDiff.toFixed(2)} > tol=${tolerance.toFixed(2)})`);
    }
  }
}

  // Get all portfolios for user
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, base_currency")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!portfolios || portfolios.length === 0) return;

  for (const portfolio of portfolios) {
    // Get all transactions for this portfolio
    const { data: txns } = await supabase
      .from("transactions")
      .select("security_id, transaction_type, quantity, price, currency, net_amount")
      .eq("portfolio_id", portfolio.id)
      .in("transaction_type", ["BUY", "SELL"])
      .order("trade_date", { ascending: true });

    if (!txns || txns.length === 0) continue;

    // Aggregate per security
    const posMap = new Map<string, { qty: number; totalCost: number; currency: string }>();

    for (const tx of txns) {
      const entry = posMap.get(tx.security_id) ?? { qty: 0, totalCost: 0, currency: tx.currency };

      if (tx.transaction_type === "BUY") {
        entry.totalCost += tx.quantity * tx.price;
        entry.qty += tx.quantity;
      } else {
        // SELL: reduce position, proportional cost reduction
        const avgCost = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
        entry.qty -= tx.quantity;
        entry.totalCost = entry.qty > 0 ? avgCost * entry.qty : 0;
      }

      posMap.set(tx.security_id, entry);
    }

    // Upsert positions
    for (const [securityId, pos] of posMap) {
      const avgCost = pos.qty > 0 ? pos.totalCost / pos.qty : 0;

      const { data: existing } = await supabase
        .from("positions")
        .select("id")
        .eq("portfolio_id", portfolio.id)
        .eq("security_id", securityId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("positions")
          .update({
            quantity: Math.max(0, pos.qty),
            avg_cost_basis: Math.round(avgCost * 10000) / 10000,
            total_cost_basis: Math.round(pos.totalCost * 100) / 100,
            last_updated: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else if (pos.qty > 0) {
        await supabase.from("positions").insert({
          portfolio_id: portfolio.id,
          security_id: securityId,
          quantity: pos.qty,
          avg_cost_basis: Math.round(avgCost * 10000) / 10000,
          total_cost_basis: Math.round(pos.totalCost * 100) / 100,
          currency: pos.currency,
        });
      }
    }
  }
}

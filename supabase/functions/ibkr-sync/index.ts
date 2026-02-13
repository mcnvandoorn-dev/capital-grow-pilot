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
  maxRetries = 5
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    const url = `${IBKR_GET_URL}?q=${refCode}&t=${token}&v=3`;
    const res = await fetch(url);
    const xml = await res.text();

    const status = extractTag(xml, "Status");
    if (status === "Warn") continue; // not ready yet
    if (status === "Fail") {
      const errMsg = extractTag(xml, "ErrorMessage") || "Unknown";
      throw new Error(`IBKR GetStatement failed: ${errMsg}`);
    }
    // Success or raw XML with data
    if (xml.includes("<FlexQueryResponse") || xml.includes("<FlexStatement")) {
      return xml;
    }
  }
  throw new Error("IBKR report not ready after max retries");
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

    const { connectionId } = await req.json();
    if (!connectionId) throw new Error("Missing connectionId");

    // Get IBKR connection
    const { data: conn, error: connErr } = await supabase
      .from("ibkr_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connErr || !conn) throw new Error("IBKR connection not found");
    if (!conn.flex_token || !conn.flex_query_id)
      throw new Error("Flex token or query ID not configured");

    // Create sync log
    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({
        user_id: user.id,
        ibkr_connection_id: conn.id,
        sync_source: "FLEX_QUERY",
        status: "running",
      })
      .select()
      .single();

    // Update connection status
    await supabase
      .from("ibkr_connections")
      .update({ sync_status: "syncing" })
      .eq("id", conn.id);

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    try {
      // Step 1: Request report
      const refCode = await requestFlexReport(conn.flex_token, conn.flex_query_id);

      // Step 2: Fetch report XML
      const xml = await fetchFlexStatement(conn.flex_token, refCode);

      // DEBUG: Log XML structure to understand what IBKR returns
      console.log("XML length:", xml.length);
      console.log("XML first 2000 chars:", xml.substring(0, 2000));
      console.log("Contains <Trade:", xml.includes("<Trade"));
      console.log("Contains <Order:", xml.includes("<Order"));
      console.log("Contains <OpenPosition:", xml.includes("<OpenPosition"));

      // Step 3: Parse trades
      const trades = extractAttributes(xml, "Trade");
      console.log("Parsed trades count:", trades.length);
      if (trades.length > 0) {
        console.log("Sample trade:", JSON.stringify(trades[0]));
      }

      // Also try OpenPosition for current holdings
      const openPositions = extractAttributes(xml, "OpenPosition");
      console.log("Parsed open positions count:", openPositions.length);
      if (openPositions.length > 0) {
        console.log("Sample open position:", JSON.stringify(openPositions[0]));
      }
      for (const t of trades) {
        recordsProcessed++;
        if (!t.symbol || !t.tradeDate) continue;

        // Upsert security
        const { data: sec } = await supabase
          .from("securities")
          .upsert(
            {
              ticker: t.symbol,
              name: t.description || null,
              conid: t.conid || null,
              exchange: t.listingExchange || t.exchange || null,
              currency: (t.currency as any) || "USD",
              asset_class: mapAssetClass(t.assetCategory),
              isin: t.isin || null,
            },
            { onConflict: "ticker" }
          )
          .select("id")
          .single();

        if (!sec) continue;

        // Find or get portfolio
        const portfolioId = await getOrCreatePortfolio(
          supabase,
          user.id,
          conn.id,
          t.accountId || null,
          (t.currency as any) || "USD"
        );

        // Check if trade already exists
        if (t.tradeID) {
          const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("ibkr_trade_id", t.tradeID)
            .maybeSingle();

          if (existing) {
            recordsUpdated++;
            continue;
          }
        }

        const qty = parseNum(t.quantity);
        const price = parseNum(t.tradePrice || t.price);
        const commission = parseNum(t.ibCommission || t.commission);
        const grossAmount = parseNum(t.proceeds || String(qty * price));
        const netAmount = grossAmount + commission;
        const fxRate = parseNum(t.fxRateToBase) || 1;

        const txType = qty > 0 ? "BUY" : "SELL";

        const { error: txErr } = await supabase.from("transactions").insert({
          portfolio_id: portfolioId,
          security_id: sec.id,
          transaction_type: txType,
          trade_date: formatDate(t.tradeDate),
          settlement_date: t.settleDateTarget
            ? formatDate(t.settleDateTarget)
            : null,
          quantity: Math.abs(qty),
          price: Math.abs(price),
          commission: Math.abs(commission),
          gross_amount: Math.abs(grossAmount),
          net_amount: Math.abs(netAmount),
          currency: (t.currency as any) || "USD",
          fx_rate_to_base: fxRate,
          ibkr_trade_id: t.tradeID || null,
          sync_source: "FLEX_QUERY",
        });

        if (!txErr) recordsCreated++;
      }

      // Step 4: Parse dividends (CashTransaction with type Dividends/Payment In Lieu Of Dividends)
      const cashTxns = extractAttributes(xml, "CashTransaction");
      for (const ct of cashTxns) {
        const ctType = (ct.type || "").toLowerCase();
        if (
          !ctType.includes("dividend") &&
          !ctType.includes("payment in lieu")
        )
          continue;

        recordsProcessed++;
        if (!ct.symbol || !ct.dateTime) continue;

        const { data: sec } = await supabase
          .from("securities")
          .select("id")
          .eq("ticker", ct.symbol)
          .maybeSingle();

        if (!sec) continue;

        const portfolioId = await getOrCreatePortfolio(
          supabase,
          user.id,
          conn.id,
          ct.accountId || null,
          (ct.currency as any) || "USD"
        );

        const amount = parseNum(ct.amount);
        const tax = parseNum(ct.tax);
        const fxRate = parseNum(ct.fxRateToBase) || 1;
        const isRoc = ctType.includes("return of capital");
        const exDate = formatDate(ct.reportDate || ct.dateTime);

        // Check duplicate by security + date + amount
        const { data: existing } = await supabase
          .from("dividend_history")
          .select("id")
          .eq("security_id", sec.id)
          .eq("portfolio_id", portfolioId)
          .eq("ex_date", exDate)
          .maybeSingle();

        if (existing) {
          recordsUpdated++;
          continue;
        }

        const totalAmount = Math.abs(amount);
        const withholdingTax = Math.abs(tax);

        await supabase.from("dividend_history").insert({
          portfolio_id: portfolioId,
          security_id: sec.id,
          ex_date: exDate,
          total_amount: totalAmount,
          withholding_tax: withholdingTax,
          net_amount: totalAmount - withholdingTax,
          amount_per_share: 0, // Will be recalculated
          currency: (ct.currency as any) || "USD",
          fx_rate_to_base: fxRate,
          is_roc: isRoc,
          sync_source: "FLEX_QUERY",
        });

        recordsCreated++;
      }

      // Step 5: Recalculate positions from transactions
      await recalculatePositions(supabase, user.id);

      // Update sync log as success
      await supabase
        .from("sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_processed: recordsProcessed,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
        })
        .eq("id", syncLog!.id);

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

function mapAssetClass(
  ibkrClass: string | undefined
): "CEF" | "BDC" | "REIT" | "ETF" | "PREFERRED" | "BABY_BOND" | "OTHER" {
  if (!ibkrClass) return "OTHER";
  const c = ibkrClass.toUpperCase();
  if (c.includes("STK") || c.includes("STOCK")) return "OTHER";
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

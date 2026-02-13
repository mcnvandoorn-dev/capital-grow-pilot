import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FLEX_BASE = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 10_000; // 10 seconds between retries

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Step 1: Send request to get reference code */
async function sendFlexRequest(token: string, queryId: string): Promise<string> {
  const url = `${FLEX_BASE}.SendRequest?t=${token}&q=${queryId}&v=3`;
  const res = await fetch(url);
  const text = await res.text();
  console.log(`SendRequest raw response (first 500 chars): ${text.substring(0, 500)}`);

  // Extract reference code from XML
  const refMatch = text.match(/<ReferenceCode>(\d+)<\/ReferenceCode>/);
  if (!refMatch) {
    const errMatch = text.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
    throw new Error(`Flex SendRequest failed: ${errMatch?.[1] ?? text.substring(0, 200)}`);
  }
  return refMatch[1];
}

/** Step 2: Get statement with retries */
async function getFlexStatement(token: string, refCode: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const url = `${FLEX_BASE}.GetStatement?t=${token}&q=${refCode}&v=3`;
    const res = await fetch(url);
    const text = await res.text();

    // Check if statement is ready
    if (text.includes("<FlexStatements") || text.includes("<FlexQueryResponse")) {
      return text;
    }

    // Check for "not yet available" status
    if (text.includes("Statement generation in progress") || text.includes("is being generated")) {
      console.log(`Statement not ready, retry ${attempt + 1}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const errMatch = text.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
    if (errMatch) {
      throw new Error(`Flex GetStatement error: ${errMatch[1]}`);
    }

    // Unknown response, retry
    console.log(`Unknown response, retry ${attempt + 1}/${MAX_RETRIES}...`);
    await sleep(RETRY_DELAY_MS);
  }
  throw new Error("Flex statement not available after max retries");
}

/** Simple XML tag extraction helpers */
function extractAttr(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "g");
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function extractAllElements(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\s[^>]*\\/>|<${tag}\\s[^>]*>.*?<\\/${tag}>`, "gs");
  return [...xml.matchAll(regex)].map((m) => m[0]);
}

function getAttr(element: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = element.match(regex);
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("IBKR_FLEX_TOKEN");
    const queryId = Deno.env.get("IBKR_QUERY_ID");

    if (!token || !queryId) {
      throw new Error("Missing IBKR_FLEX_TOKEN or IBKR_QUERY_ID");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log("Step 1: Requesting Flex statement...");
    console.log(`Token length: ${token.length}, QueryID: ${queryId}`);
    const sendUrl = `${FLEX_BASE}.SendRequest?t=${token}&q=${queryId}&v=3`;
    console.log(`Request URL: ${sendUrl}`);
    const refCode = await sendFlexRequest(token, queryId);
    console.log(`Reference code: ${refCode}`);

    console.log("Step 2: Fetching statement (with retries)...");
    await sleep(5000); // Initial wait
    const xml = await getFlexStatement(token, refCode);
    console.log(`Statement received, length: ${xml.length}`);
    // Log first 2000 chars to debug XML structure
    console.log(`XML preview: ${xml.substring(0, 2000)}`);

    // Parse account summary (FlexStatement level attributes or EquitySummaryInBase)
    const today = new Date().toISOString().split("T")[0];

    // Try to find NetLiquidation from EquitySummaryInBase or CashReport
    let netLiquidation = 0;
    let cashBalance = 0;

    // Log what sections exist in the XML
    const sectionTags = [...xml.matchAll(/<(\w+)[\s>\/]/g)].map(m => m[1]);
    const uniqueTags = [...new Set(sectionTags)];
    console.log(`XML tags found: ${uniqueTags.join(", ")}`);

    // Try NAV in Base (user selected "Net Asset Value (NAV) in Base" with "Total")
    for (const tagName of ["NAV", "NAVInBase", "EquitySummaryByReportDateInBase", "EquitySummaryInBase"]) {
      if (netLiquidation !== 0) break;
      const elements = extractAllElements(xml, tagName);
      console.log(`Checking ${tagName}: found ${elements.length} elements`);
      for (const el of elements) {
        const total = getAttr(el, "total");
        if (total) { netLiquidation = parseFloat(total); break; }
        const totalLong = getAttr(el, "totalLong");
        if (totalLong) { netLiquidation = parseFloat(totalLong); break; }
      }
    }

    // CashReportCurrency - take the last element as base currency summary
    // (when "Base Currency Summary" is selected, IBKR puts it as the last element)
    const cashReports = extractAllElements(xml, "CashReportCurrency");
    console.log(`Found ${cashReports.length} CashReportCurrency elements`);
    
    // First try to find BASE_SUMMARY by currency attribute
    for (const el of cashReports) {
      const currency = getAttr(el, "currency");
      if (currency === "BASE_SUMMARY") {
        const cb = getAttr(el, "endingCash");
        if (cb) cashBalance = parseFloat(cb);
        break;
      }
    }
    
    // If no BASE_SUMMARY found, use the last element (base currency summary)
    if (cashBalance === 0 && cashReports.length > 0) {
      const lastEl = cashReports[cashReports.length - 1];
      const cb = getAttr(lastEl, "endingCash");
      if (cb) cashBalance = parseFloat(cb);
      console.log(`Using last CashReportCurrency element, endingCash=${cb}`);
    }

    // Fallback: try FlexStatement attributes
    if (netLiquidation === 0) {
      const stmts = extractAllElements(xml, "FlexStatement");
      for (const el of stmts) {
        const nl = getAttr(el, "netLiquidation");
        if (nl) netLiquidation = parseFloat(nl);
        const cb = getAttr(el, "cashBalance");
        if (cb) cashBalance = parseFloat(cb);
      }
    }

    console.log(`Parsed: NLV=${netLiquidation}, Cash=${cashBalance}`);

    // Get user - try ibkr_connections first, then fall back to profiles table
    let userId: string | null = null;
    
    const { data: connections } = await supabase
      .from("ibkr_connections")
      .select("user_id")
      .limit(1);
    
    userId = connections?.[0]?.user_id ?? null;
    
    // Fallback: get first user from profiles
    if (!userId) {
      const { data: profileUsers } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(1);
      userId = profileUsers?.[0]?.user_id ?? null;
    }

    if (!userId) {
      throw new Error("No user found - cannot determine user");
    }

    if (netLiquidation !== 0 || cashBalance !== 0) {
      const { error: summaryErr } = await supabase
        .from("daily_account_summary")
        .upsert(
          {
            user_id: userId,
            date: today,
            net_liquidation: netLiquidation,
            cash_balance: cashBalance,
          },
          { onConflict: "user_id,date" }
        );
      if (summaryErr) console.error("Summary upsert error:", summaryErr);
      else console.log(`Account summary saved: NLV=${netLiquidation}, Cash=${cashBalance}`);
    }

    // Parse trades - try both "Trade" and "Order" tags
    let tradeElements = extractAllElements(xml, "Trade");
    if (tradeElements.length === 0) {
      tradeElements = extractAllElements(xml, "Order");
    }
    console.log(`Found ${tradeElements.length} trade elements`);
    let tradesInserted = 0;
    let tradesSkipped = 0;

    for (const el of tradeElements) {
      const tradeDate = getAttr(el, "tradeDate");
      const symbol = getAttr(el, "symbol");
      const qty = getAttr(el, "quantity");
      const price = getAttr(el, "tradePrice");
      const buySell = getAttr(el, "buySell");
      const realizedPnl = getAttr(el, "fifoPnlRealized");

      if (!tradeDate || !symbol || !qty || !price || !buySell) continue;

      // Format date from YYYYMMDD to YYYY-MM-DD
      const formattedDate = tradeDate.length === 8
        ? `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`
        : tradeDate;

      const { error: tradeErr } = await supabase
        .from("trades")
        .upsert(
          {
            user_id: userId,
            trade_date: formattedDate,
            symbol,
            quantity: parseFloat(qty),
            price: parseFloat(price),
            side: buySell,
            realized_pnl: realizedPnl ? parseFloat(realizedPnl) : null,
          },
          { onConflict: "user_id,trade_date,symbol,side,quantity,price" }
        );

      if (tradeErr) {
        console.error(`Trade insert error for ${symbol}:`, tradeErr);
        tradesSkipped++;
      } else {
        tradesInserted++;
      }
    }

    console.log(`Trades: ${tradesInserted} inserted, ${tradesSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        net_liquidation: netLiquidation,
        cash_balance: cashBalance,
        trades_inserted: tradesInserted,
        trades_skipped: tradesSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("IBKR daily sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

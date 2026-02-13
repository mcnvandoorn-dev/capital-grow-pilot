import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    // Get latest summary
    let summaryQuery = supabase
      .from("daily_account_summary")
      .select("*")
      .order("date", { ascending: false })
      .limit(1);

    if (dateParam) {
      summaryQuery = supabase
        .from("daily_account_summary")
        .select("*")
        .eq("date", dateParam)
        .limit(1);
    }

    const { data: summaries, error: sumErr } = await summaryQuery;
    if (sumErr) throw sumErr;

    const summary = summaries?.[0];
    const targetDate = summary?.date ?? dateParam ?? new Date().toISOString().split("T")[0];

    // Get trades for that date
    const { data: trades, error: tradeErr } = await supabase
      .from("trades")
      .select("*")
      .eq("trade_date", targetDate)
      .order("symbol");

    if (tradeErr) throw tradeErr;

    return new Response(
      JSON.stringify({
        date: targetDate,
        netLiquidation: summary?.net_liquidation ?? null,
        cashBalance: summary?.cash_balance ?? null,
        trades: (trades ?? []).map((t) => ({
          symbol: t.symbol,
          quantity: t.quantity,
          price: t.price,
          side: t.side,
          realizedPnl: t.realized_pnl,
          tradeDate: t.trade_date,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ibkr-daily error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

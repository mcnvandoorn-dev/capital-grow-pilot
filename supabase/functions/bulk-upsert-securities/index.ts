import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      .select("id, ticker")
      .in("ticker", cleanedTickers);
    if (fetchErr) throw fetchErr;

    const existingMap = new Map(
      (existing ?? []).map((s: any) => [s.ticker, s.id])
    );
    const missing = cleanedTickers.filter(
      (t: string) => !existingMap.has(t)
    );

    // Create missing securities using service role
    if (missing.length > 0) {
      const { data: created, error: createErr } = await adminClient
        .from("securities")
        .insert(
          missing.map((ticker: string) => ({
            ticker,
            asset_class: "OTHER",
          }))
        )
        .select("id, ticker");
      if (createErr) throw createErr;
      created?.forEach((s: any) => existingMap.set(s.ticker, s.id));
    }

    // Add to user's watchlist (using anon client with user's JWT for RLS)
    const { data: existingWl } = await anonClient
      .from("watchlist")
      .select("security_id")
      .eq("user_id", user.id);
    const existingWlIds = new Set(
      (existingWl ?? []).map((w: any) => w.security_id)
    );

    const toInsert = cleanedTickers
      .map((t: string) => existingMap.get(t))
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

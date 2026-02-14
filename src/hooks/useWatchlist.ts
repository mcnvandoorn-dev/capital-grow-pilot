import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type MarketDataSnapshot = {
  close_price: number | null;
  market_price: number | null;
  nav: number | null;
  rsi_14: number | null;
  z_score: number | null;
  high_52w: number | null;
  low_52w: number | null;
};

export type WatchlistItemWithDetails = Tables<"watchlist"> & {
  securities: Pick<
    Tables<"securities">,
    "id" | "ticker" | "name" | "asset_class" | "sector" | "currency"
  > | null;
  marketData?: MarketDataSnapshot;
};

export function useWatchlist() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["watchlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist")
        .select("*, securities(id, ticker, name, asset_class, sector, currency)")
        .order("added_at", { ascending: false });

      if (error) throw error;
      const items = data as WatchlistItemWithDetails[];

      // Fetch latest market data for all security IDs
      const secIds = items
        .map((i) => i.securities?.id)
        .filter((id): id is string => !!id);

      if (secIds.length === 0) return items;

      // Get latest market data per security (most recent date)
      const { data: mdRows } = await supabase
        .from("market_data")
        .select("security_id, close_price, market_price, nav, rsi_14, z_score, data_date")
        .in("security_id", secIds)
        .order("data_date", { ascending: false });

      // Build map: latest row per security
      const latestMap = new Map<string, typeof mdRows extends (infer T)[] | null ? T : never>();
      for (const row of mdRows ?? []) {
        if (!latestMap.has(row.security_id)) {
          latestMap.set(row.security_id, row);
        }
      }

      // Get 52-week high/low per security
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const dateStr = oneYearAgo.toISOString().split("T")[0];

      const { data: rangeRows } = await supabase
        .from("market_data")
        .select("security_id, close_price")
        .in("security_id", secIds)
        .gte("data_date", dateStr);

      const rangeMap = new Map<string, { high: number; low: number }>();
      for (const row of rangeRows ?? []) {
        if (row.close_price == null) continue;
        const existing = rangeMap.get(row.security_id);
        if (!existing) {
          rangeMap.set(row.security_id, { high: row.close_price, low: row.close_price });
        } else {
          if (row.close_price > existing.high) existing.high = row.close_price;
          if (row.close_price < existing.low) existing.low = row.close_price;
        }
      }

      // Merge into items
      return items.map((item) => {
        const secId = item.securities?.id;
        if (!secId) return item;
        const latest = latestMap.get(secId);
        const range = rangeMap.get(secId);
        return {
          ...item,
          marketData: {
            close_price: latest?.close_price ?? null,
            market_price: latest?.market_price ?? null,
            nav: latest?.nav ?? null,
            rsi_14: latest?.rsi_14 ?? null,
            z_score: latest?.z_score ?? null,
            high_52w: range?.high ?? null,
            low_52w: range?.low ?? null,
          },
        };
      });
    },
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (securityId: string) => {
      const { data, error } = await supabase
        .from("watchlist")
        .insert({ security_id: securityId, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

/** Look up which tickers already exist in the securities table */
export async function lookupExistingTickers(tickers: string[]): Promise<Set<string>> {
  if (tickers.length === 0) return new Set();
  const { data } = await supabase
    .from("securities")
    .select("ticker")
    .in("ticker", tickers);
  return new Set((data ?? []).map((s) => s.ticker));
}

/** Bulk import via edge function (handles security creation with service role) */
export function useBulkImportWatchlist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tickers: string[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-upsert-securities", {
        body: { tickers },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { added: number; skipped: number; total: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

// Keep legacy hook for backward compat but route through edge function
export function useBulkAddToWatchlist() {
  return useBulkImportWatchlist();
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

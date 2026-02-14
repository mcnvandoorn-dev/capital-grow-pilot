import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type WatchlistItemWithDetails = Tables<"watchlist"> & {
  securities: Pick<
    Tables<"securities">,
    "id" | "ticker" | "name" | "asset_class" | "sector" | "currency"
  > | null;
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
      return data as WatchlistItemWithDetails[];
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

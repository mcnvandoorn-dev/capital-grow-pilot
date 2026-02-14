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

export function useBulkAddToWatchlist() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (tickers: string[]) => {
      // Find or create securities for these tickers
      const uniqueTickers = [...new Set(tickers.map((t) => t.toUpperCase().trim()).filter(Boolean))];

      // Get existing securities
      const { data: existing, error: fetchErr } = await supabase
        .from("securities")
        .select("id, ticker")
        .in("ticker", uniqueTickers);
      if (fetchErr) throw fetchErr;

      const existingMap = new Map((existing ?? []).map((s) => [s.ticker, s.id]));
      const missing = uniqueTickers.filter((t) => !existingMap.has(t));

      // Create missing securities
      if (missing.length > 0) {
        const { data: created, error: createErr } = await supabase
          .from("securities")
          .insert(missing.map((ticker) => ({ ticker, asset_class: "OTHER" as const })))
          .select("id, ticker");
        if (createErr) throw createErr;
        created?.forEach((s) => existingMap.set(s.ticker, s.id));
      }

      // Get existing watchlist items to avoid duplicates
      const { data: existingWl } = await supabase
        .from("watchlist")
        .select("security_id")
        .eq("user_id", user!.id);
      const existingWlIds = new Set((existingWl ?? []).map((w) => w.security_id));

      const toInsert = uniqueTickers
        .map((t) => existingMap.get(t))
        .filter((id): id is string => !!id && !existingWlIds.has(id))
        .map((security_id) => ({ security_id, user_id: user!.id }));

      if (toInsert.length === 0) return { added: 0, skipped: uniqueTickers.length };

      const { error: insertErr } = await supabase.from("watchlist").insert(toInsert);
      if (insertErr) throw insertErr;

      return { added: toInsert.length, skipped: uniqueTickers.length - toInsert.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
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

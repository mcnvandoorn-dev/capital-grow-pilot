import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RebalanceProposal } from "@/components/rebalancing/RebalanceResults";
import type { RebalancePreferences } from "@/components/rebalancing/RebalanceQuestionnaire";

export interface RebalanceHistoryItem {
  id: string;
  created_at: string;
  preferences: RebalancePreferences;
  proposal: RebalanceProposal;
}

export function useRebalanceHistory() {
  return useQuery({
    queryKey: ["rebalance-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rebalance_proposals")
        .select("id, created_at, preferences, proposal")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as RebalanceHistoryItem[];
    },
  });
}

export function useSaveRebalanceProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      preferences,
      proposal,
    }: {
      preferences: RebalancePreferences;
      proposal: RebalanceProposal;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("rebalance_proposals").insert({
        user_id: user.id,
        preferences: preferences as any,
        proposal: proposal as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebalance-history"] });
    },
  });
}

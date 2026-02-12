import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type AlertWithSecurity = Tables<"alerts"> & {
  securities: Pick<Tables<"securities">, "ticker" | "name" | "asset_class"> | null;
};

export function useAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, securities(ticker, name, asset_class)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AlertWithSecurity[];
    },
  });
}

export function useSecuritiesForSelect() {
  return useQuery({
    queryKey: ["securities-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("securities")
        .select("id, ticker, name, asset_class")
        .eq("is_active", true)
        .order("ticker");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      alert: Omit<TablesInsert<"alerts">, "user_id">
    ) => {
      const { data, error } = await supabase
        .from("alerts")
        .insert({ ...alert, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useToggleAlert() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("alerts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type PrivateInvestment = {
  id: string;
  user_id: string;
  name: string;
  asset_type: string;
  invested_amount: number;
  current_value: number | null;
  annual_cashflow: number;
  cashflow_frequency: string;
  expected_growth_pct: number | null;
  start_date: string;
  exit_horizon: string | null;
  currency: string;
  sector_label: string | null;
  geography_label: string | null;
  risk_bucket: string | null;
  notes: string | null;
  has_loan: boolean;
  loan_amount: number | null;
  loan_interest_rate: number | null;
  loan_monthly_payment: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PrivateInvestmentInsert = Omit<PrivateInvestment, "id" | "created_at" | "updated_at" | "user_id" | "is_active">;

export function usePrivateInvestments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["private-investments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_investments")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrivateInvestment[];
    },
  });
}

export function useAddPrivateInvestment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: PrivateInvestmentInsert) => {
      const { data, error } = await supabase
        .from("private_investments")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-investments"] }),
  });
}

export function useUpdatePrivateInvestment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PrivateInvestment> & { id: string }) => {
      const { error } = await supabase
        .from("private_investments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-investments"] }),
  });
}

export function useDeletePrivateInvestment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("private_investments")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-investments"] }),
  });
}

// Aggregated metrics for strategy integration
export function usePrivateInvestmentMetrics(investments?: PrivateInvestment[]) {
  const items = investments ?? [];
  const totalInvested = items.reduce((s, i) => s + i.invested_amount, 0);
  const totalCurrentValue = items.reduce((s, i) => s + (i.current_value ?? i.invested_amount), 0);
  const totalAnnualCashflow = items.reduce((s, i) => s + i.annual_cashflow, 0);
  const unrealizedPnl = totalCurrentValue - totalInvested;
  const unrealizedPnlPct = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;

  // 5-year income projection with growth
  const projectedIncome5y = Array.from({ length: 5 }, (_, yr) => {
    let base = 0;
    let optimistic = 0;
    let conservative = 0;
    for (const inv of items) {
      const growth = (inv.expected_growth_pct ?? 0) / 100;
      base += inv.annual_cashflow * Math.pow(1 + growth, yr + 1);
      optimistic += inv.annual_cashflow * Math.pow(1 + growth * 1.5, yr + 1);
      conservative += inv.annual_cashflow * Math.pow(1 + growth * 0.5, yr + 1);
    }
    return {
      year: new Date().getFullYear() + yr + 1,
      base,
      optimistic,
      conservative,
    };
  });

  // Sector breakdown
  const sectorMap = new Map<string, number>();
  for (const inv of items) {
    const label = inv.sector_label ?? "Overig";
    sectorMap.set(label, (sectorMap.get(label) ?? 0) + (inv.current_value ?? inv.invested_amount));
  }
  const sectorBreakdown = [...sectorMap.entries()]
    .map(([sector, value]) => ({ sector, value, pct: totalCurrentValue > 0 ? (value / totalCurrentValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  return {
    totalInvested,
    totalCurrentValue,
    totalAnnualCashflow,
    unrealizedPnl,
    unrealizedPnlPct,
    projectedIncome5y,
    sectorBreakdown,
    count: items.length,
    illiquidPct: 100, // all private = illiquid
  };
}

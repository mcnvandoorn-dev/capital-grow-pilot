import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PositionWithDetails } from "./usePortfolioData";

export interface SecurityDividendMetrics {
  securityId: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  annualDividendEur: number;
  annualGrossEur: number;
  annualTaxEur: number;
  currentYield: number | null;
  paymentCount12m: number;
  frequency: string;
  growthPct: number | null;
  incomeShare: number;
}

export interface DividendIntelligence {
  totalAnnualIncome: number;
  totalAnnualGross: number;
  totalAnnualTax: number;
  weightedYield: number | null;
  avgGrowthPct: number | null;
  securities: SecurityDividendMetrics[];
  sectorBreakdown: { sector: string; amount: number; pct: number }[];
  projectedIncome5y: {
    year: number;
    base: number;
    optimistic: number;
    conservative: number;
  }[];
}

export function useDividendIntelligence(
  portfolioIds: string[],
  positions?: PositionWithDetails[]
) {
  return useQuery({
    queryKey: ["dividend-intelligence", portfolioIds],
    queryFn: async (): Promise<DividendIntelligence> => {
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);

      const { data: dividends, error } = await supabase
        .from("dividend_history")
        .select("security_id, net_amount, total_amount, withholding_tax, fx_rate_to_base, ex_date")
        .in("portfolio_id", portfolioIds)
        .order("ex_date", { ascending: true });

      if (error) throw error;
      if (!dividends || dividends.length === 0) {
        return {
          totalAnnualIncome: 0,
          totalAnnualGross: 0,
          totalAnnualTax: 0,
          weightedYield: null,
          avgGrowthPct: null,
          securities: [],
          sectorBreakdown: [],
          projectedIncome5y: [],
        };
      }

      // Fetch security details
      const secIds = [...new Set(dividends.map((d) => d.security_id))];
      const { data: securities } = await supabase
        .from("securities")
        .select("id, ticker, name, sector")
        .in("id", secIds);

      const secMap = new Map(
        (securities ?? []).map((s) => [s.id, s])
      );

      // Market values from positions for yield calculation
      const mvMap = new Map<string, number>();
      for (const p of positions ?? []) {
        if (p.market_value != null) {
          mvMap.set(
            p.security_id,
            (mvMap.get(p.security_id) ?? 0) + p.market_value
          );
        }
      }

      // Group dividends by security
      const divBySec = new Map<string, typeof dividends>();
      for (const d of dividends) {
        const arr = divBySec.get(d.security_id) ?? [];
        arr.push(d);
        divBySec.set(d.security_id, arr);
      }

      let totalAnnualIncome = 0;
      let totalAnnualGross = 0;
      let totalAnnualTax = 0;
      let totalMarketValue = 0;
      const secMetrics: SecurityDividendMetrics[] = [];
      const growthRates: number[] = [];

      for (const [secId, divs] of divBySec) {
        const sec = secMap.get(secId);
        if (!sec) continue;

        // Last 12 months
        const last12m = divs.filter(
          (d) => new Date(d.ex_date) >= oneYearAgo
        );
        const annualDiv = last12m.reduce(
          (s, d) => s + d.net_amount * d.fx_rate_to_base,
          0
        );
        const annualGross = last12m.reduce(
          (s, d) => s + (d.total_amount ?? d.net_amount) * d.fx_rate_to_base,
          0
        );
        const annualTax = last12m.reduce(
          (s, d) => s + (d.withholding_tax ?? 0) * d.fx_rate_to_base,
          0
        );

        // YoY growth (needs 2 years of data - no fallback to avoid misleading metrics)
        const prev12m = divs.filter((d) => {
          const dt = new Date(d.ex_date);
          return dt >= twoYearsAgo && dt < oneYearAgo;
        });
        const prevDiv = prev12m.reduce(
          (s, d) => s + d.net_amount * d.fx_rate_to_base,
          0
        );

        let growthPct: number | null = null;
        if (prevDiv > 10) {
          growthPct = ((annualDiv - prevDiv) / prevDiv) * 100;
        }
        if (growthPct !== null) growthRates.push(growthPct);

        // Payment frequency estimation
        const count = last12m.length;
        let frequency = "onbekend";
        if (count >= 11) frequency = "maandelijks";
        else if (count >= 3) frequency = "kwartaal";
        else if (count >= 2) frequency = "halfjaarlijks";
        else if (count >= 1) frequency = "jaarlijks";

        // Current yield
        const mv = mvMap.get(secId);
        const currentYield =
          mv && mv > 0 ? (annualDiv / mv) * 100 : null;

        totalAnnualIncome += annualDiv;
        if (mv) totalMarketValue += mv;

        secMetrics.push({
          securityId: secId,
          ticker: sec.ticker,
          name: sec.name,
          sector: sec.sector,
          annualDividendEur: annualDiv,
          currentYield,
          paymentCount12m: count,
          frequency,
          growthPct,
          incomeShare: 0,
        });
      }

      // Compute income shares
      for (const m of secMetrics) {
        m.incomeShare =
          totalAnnualIncome > 0
            ? (m.annualDividendEur / totalAnnualIncome) * 100
            : 0;
      }
      secMetrics.sort((a, b) => b.annualDividendEur - a.annualDividendEur);

      // Sector breakdown
      const sectorAgg = new Map<string, number>();
      for (const m of secMetrics) {
        const sector = m.sector ?? "Overig";
        sectorAgg.set(
          sector,
          (sectorAgg.get(sector) ?? 0) + m.annualDividendEur
        );
      }
      const sectorBreakdown = [...sectorAgg.entries()]
        .map(([sector, amount]) => ({
          sector,
          amount,
          pct:
            totalAnnualIncome > 0
              ? (amount / totalAnnualIncome) * 100
              : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // 5-year income projection
      const avgGrowthPct =
        growthRates.length > 0
          ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
          : null;
      const baseRate = Math.max(
        0,
        Math.min((avgGrowthPct ?? 3) / 100, 0.15)
      );
      const projectedIncome5y = Array.from({ length: 5 }, (_, i) => ({
        year: now.getFullYear() + i + 1,
        base: totalAnnualIncome * Math.pow(1 + baseRate, i + 1),
        optimistic:
          totalAnnualIncome * Math.pow(1 + baseRate * 1.5, i + 1),
        conservative:
          totalAnnualIncome * Math.pow(1 + baseRate * 0.5, i + 1),
      }));

      const weightedYield =
        totalMarketValue > 0
          ? (totalAnnualIncome / totalMarketValue) * 100
          : null;

      return {
        totalAnnualIncome,
        weightedYield,
        avgGrowthPct,
        securities: secMetrics,
        sectorBreakdown,
        projectedIncome5y,
      };
    },
    enabled: portfolioIds.length > 0,
  });
}

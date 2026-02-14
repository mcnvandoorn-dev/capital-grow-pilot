import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";

export interface ExposureSlice {
  label: string;
  sub_label: string | null;
  weight: number; // aggregated portfolio-level weight (0-100%)
  source: string;
  confidence: string;
}

export interface LookThroughData {
  revenueExposure: ExposureSlice[];
  geographicExposure: ExposureSlice[];
  riskBuckets: ExposureSlice[];
  capitalStructure: ExposureSlice[];
  topEconomicExposures: { label: string; weight: number; tickers: string[] }[];
  coveragePercent: number;
}

export function useLookThroughExposures(positions: PositionWithDetails[] | undefined) {
  const securityIds = useMemo(
    () => (positions ?? []).map((p) => p.security_id),
    [positions]
  );

  const { data: rawExposures, isLoading } = useQuery({
    queryKey: ["issuer-exposures", securityIds],
    queryFn: async () => {
      if (securityIds.length === 0) return [];
      const { data, error } = await supabase
        .from("issuer_exposures")
        .select("*")
        .in("security_id", securityIds);
      if (error) throw error;
      return data;
    },
    enabled: securityIds.length > 0,
  });

  const lookThrough = useMemo((): LookThroughData => {
    if (!positions?.length || !rawExposures?.length) {
      return {
        revenueExposure: [],
        geographicExposure: [],
        riskBuckets: [],
        capitalStructure: [],
        topEconomicExposures: [],
        coveragePercent: 0,
      };
    }

    const totalPortfolioValue = positions.reduce(
      (s, p) => s + (p.market_value ?? p.total_cost_basis),
      0
    );

    // Build position weight map
    const posWeightMap = new Map<string, { weight: number; ticker: string }>();
    for (const p of positions) {
      const mv = p.market_value ?? p.total_cost_basis;
      posWeightMap.set(p.security_id, {
        weight: totalPortfolioValue > 0 ? mv / totalPortfolioValue : 0,
        ticker: p.security.ticker,
      });
    }

    // Track which securities have exposure data
    const coveredSecurityIds = new Set(rawExposures.map((e) => e.security_id));
    const coveredValue = positions
      .filter((p) => coveredSecurityIds.has(p.security_id))
      .reduce((s, p) => s + (p.market_value ?? p.total_cost_basis), 0);
    const coveragePercent =
      totalPortfolioValue > 0 ? (coveredValue / totalPortfolioValue) * 100 : 0;

    // Aggregate by exposure type
    function aggregate(exposureType: string): ExposureSlice[] {
      const map = new Map<string, { weight: number; sub_label: string | null; source: string; confidence: string }>();

      for (const exp of rawExposures.filter((e) => e.exposure_type === exposureType)) {
        const posInfo = posWeightMap.get(exp.security_id);
        if (!posInfo) continue;

        const contributedWeight = posInfo.weight * exp.weight * 100;
        const existing = map.get(exp.label);
        if (existing) {
          existing.weight += contributedWeight;
        } else {
          map.set(exp.label, {
            weight: contributedWeight,
            sub_label: exp.sub_label,
            source: exp.source,
            confidence: exp.confidence,
          });
        }
      }

      return Array.from(map.entries())
        .map(([label, data]) => ({ label, ...data }))
        .sort((a, b) => b.weight - a.weight);
    }

    const revenueExposure = aggregate("revenue_segment");
    const geographicExposure = aggregate("geographic");
    const riskBuckets = aggregate("risk_bucket");
    const capitalStructure = aggregate("capital_structure");

    // Top economic exposures: combine revenue segments with ticker attribution
    const topMap = new Map<string, { weight: number; tickers: Set<string> }>();
    for (const exp of rawExposures.filter((e) => e.exposure_type === "revenue_segment")) {
      const posInfo = posWeightMap.get(exp.security_id);
      if (!posInfo) continue;
      const contributed = posInfo.weight * exp.weight * 100;
      const existing = topMap.get(exp.label);
      if (existing) {
        existing.weight += contributed;
        existing.tickers.add(posInfo.ticker);
      } else {
        topMap.set(exp.label, { weight: contributed, tickers: new Set([posInfo.ticker]) });
      }
    }

    const topEconomicExposures = Array.from(topMap.entries())
      .map(([label, { weight, tickers }]) => ({
        label,
        weight,
        tickers: Array.from(tickers),
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 25);

    return {
      revenueExposure,
      geographicExposure,
      riskBuckets,
      capitalStructure,
      topEconomicExposures,
      coveragePercent,
    };
  }, [positions, rawExposures]);

  return { data: lookThrough, isLoading, hasData: (rawExposures?.length ?? 0) > 0 };
}

export function useGenerateExposures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      securities: {
        security_id: string;
        ticker: string;
        name: string | null;
        asset_class: string;
        sector: string | null;
        industry: string | null;
      }[]
    ) => {
      const { data, error } = await supabase.functions.invoke(
        "look-through-analyze",
        { body: { securities } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issuer-exposures"] });
    },
  });
}

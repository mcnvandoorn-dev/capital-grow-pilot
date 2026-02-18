import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import {
  RebalanceQuestionnaire,
  type RebalancePreferences,
} from "@/components/rebalancing/RebalanceQuestionnaire";
import {
  RebalanceResults,
  type RebalanceProposal,
} from "@/components/rebalancing/RebalanceResults";
import { RebalanceHistory } from "@/components/rebalancing/RebalanceHistory";
import { usePortfolios, usePositions } from "@/hooks/usePortfolioData";
import { usePortfolioBreakdown } from "@/hooks/usePortfolioBreakdown";
import { usePrivateInvestments, usePrivateInvestmentMetrics } from "@/hooks/usePrivateInvestments";
import { useSaveRebalanceProposal } from "@/hooks/useRebalanceHistory";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Scale, RotateCcw } from "lucide-react";

export default function RebalancingAdvisor() {
  const { toast } = useToast();
  const saveProposal = useSaveRebalanceProposal();

  // All portfolios (public)
  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioIds = useMemo(
    () => (portfolios ?? []).map((p) => p.id),
    [portfolios]
  );
  const { data: positions, isLoading: loadingPositions } = usePositions(portfolioIds);

  // Private investments
  const { data: privateInvestments, isLoading: loadingPrivate } = usePrivateInvestments();
  const privateMetrics = usePrivateInvestmentMetrics(privateInvestments ?? []);

  // Portfolio breakdown — now includes private investments
  const {
    assetTypeBreakdown,
    sectorBreakdown,
    regionBreakdown,
    currencyBreakdown,
    positionWeights,
    totalValue,
  } = usePortfolioBreakdown(positions ?? undefined, privateInvestments ?? undefined);

  const isLoading = loadingPortfolios || loadingPositions || loadingPrivate;
  const hasPositions = (positions?.length ?? 0) > 0 || (privateInvestments?.length ?? 0) > 0;

  const [proposal, setProposal] = useState<RebalanceProposal | null>(null);
  const [lastPrefs, setLastPrefs] = useState<RebalancePreferences | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(true);

  const handleSubmit = async (prefs: RebalancePreferences) => {
    setAnalyzing(true);
    setLastPrefs(prefs);
    try {
      // Build private investments summary for AI
      const privateSummary = (privateInvestments ?? []).map((inv) => {
        const equity = (inv.current_value ?? inv.invested_amount) - (inv.has_loan ? (inv.loan_current_balance ?? inv.loan_amount ?? 0) : 0);
        return {
          name: inv.name,
          assetType: inv.asset_type,
          sector: inv.sector_label,
          geography: inv.geography_label,
          currency: inv.currency,
          netEquity: equity,
          annualCashflow: inv.annual_cashflow,
          hasLoan: inv.has_loan,
          riskBucket: inv.risk_bucket,
        };
      });

      // Build portfolios context for AI
      const portfolioContext = (portfolios ?? []).map((p) => ({
        name: p.name,
        strategy: p.strategy,
        baseCurrency: p.base_currency,
      }));

      const { data, error } = await supabase.functions.invoke("rebalance-advisor", {
        body: {
          preferences: prefs,
          portfolio: {
            // Public positions (max 40, sorted by weight)
            positions: positionWeights.slice(0, 40).map((p) => ({
              ticker: p.ticker,
              name: p.name,
              assetClass: p.assetClass,
              sector: p.sector,
              currency: p.currency,
              weight: p.percentage,
              marketValue: p.marketValue,
              isPrivate: p.isPrivate ?? false,
            })),
            // Combined breakdowns (public + private)
            sectorBreakdown: sectorBreakdown.map((s) => ({
              sector: s.name,
              weight: s.percentage,
              count: s.count,
            })),
            assetTypeBreakdown: assetTypeBreakdown.map((a) => ({
              type: a.name,
              weight: a.percentage,
              count: a.count,
            })),
            regionBreakdown: regionBreakdown.map((r) => ({
              region: r.name,
              weight: r.percentage,
            })),
            currencyBreakdown: currencyBreakdown.map((c) => ({
              currency: c.name,
              weight: c.percentage,
            })),
            // Private investments detail
            privateInvestments: privateSummary,
            privateMetrics: {
              totalEquity: privateMetrics.totalEquity,
              totalAnnualCashflow: privateMetrics.totalAnnualCashflow,
              count: privateMetrics.count,
              privateWeightPct: totalValue > 0 ? (privateMetrics.totalEquity / totalValue) * 100 : 0,
            },
            // Portfolio info
            portfolios: portfolioContext,
            totalPortfolioValue: totalValue,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProposal(data.proposal);
      setShowQuestionnaire(false);

      // Persist to history
      saveProposal.mutate({ preferences: prefs, proposal: data.proposal });
    } catch (e: any) {
      console.error("Rebalance error:", e);
      toast({
        title: "Analyse mislukt",
        description: e.message ?? "Er is een fout opgetreden",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setProposal(null);
    setShowQuestionnaire(true);
  };

  if (isLoading) {
    return (
      <AppLayout title="Rebalancing Advisor" subtitle="AI-gestuurd herbalanceeradvies">
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPositions) {
    return (
      <AppLayout title="Rebalancing Advisor" subtitle="AI-gestuurd herbalanceeradvies">
        <EmptyState
          icon={Scale}
          title="Geen posities"
          description="Voeg posities toe aan je portfolio om herbalanceeradvies te ontvangen."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Rebalancing Advisor"
      subtitle="AI-gestuurd herbalanceeradvies"
      actions={
        proposal ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Opnieuw
          </Button>
        ) : undefined
      }
    >
      {showQuestionnaire && (
        <RebalanceQuestionnaire onSubmit={handleSubmit} isLoading={analyzing} />
      )}

      {analyzing && !proposal && (
        <div className="space-y-6 mt-6">
          <Skeleton className="h-[150px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {proposal && <RebalanceResults proposal={proposal} />}

      {/* Previous advices – always visible below the questionnaire/results */}
      {!analyzing && <RebalanceHistory />}
    </AppLayout>
  );
}

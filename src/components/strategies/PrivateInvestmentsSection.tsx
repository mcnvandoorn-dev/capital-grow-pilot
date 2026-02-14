import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Building2, DollarSign, TrendingUp, Wallet, PieChart, Lock, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrivateInvestment, useDeletePrivateInvestment, usePrivateInvestmentMetrics } from "@/hooks/usePrivateInvestments";
import { AddPrivateInvestmentDialog } from "./AddPrivateInvestmentDialog";
import { toast } from "sonner";

const ASSET_TYPE_LABELS: Record<string, string> = {
  private_equity: "Private Equity",
  private_debt: "Private Debt",
  real_estate: "Real Estate",
  venture_capital: "Venture Capital",
  family_loan: "Family Loan",
  other: "Other",
};

const FREQ_LABELS: Record<string, string> = {
  monthly: "maandelijks",
  quarterly: "kwartaal",
  annually: "jaarlijks",
};

export function PrivateInvestmentsSection({
  investments,
  fmt,
  publicValue,
  publicIncome,
}: {
  investments: PrivateInvestment[];
  fmt: (v: number) => string;
  publicValue: number;
  publicIncome: number;
}) {
  const deleteMutation = useDeletePrivateInvestment();
  const metrics = usePrivateInvestmentMetrics(investments);

  const totalPortfolioValue = publicValue + metrics.totalCurrentValue;
  const privatePct = totalPortfolioValue > 0 ? (metrics.totalCurrentValue / totalPortfolioValue) * 100 : 0;
  const totalIncome = publicIncome + metrics.totalAnnualCashflow;
  const privateIncomePct = totalIncome > 0 ? (metrics.totalAnnualCashflow / totalIncome) * 100 : 0;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Verwijderd");
    } catch {
      toast.error("Fout bij verwijderen");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Private Investments</h2>
          <Badge variant="secondary">{investments.length}</Badge>
        </div>
        <AddPrivateInvestmentDialog />
      </div>

      {investments.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">Nog geen private investeringen.</p>
            <p className="text-muted-foreground text-xs mt-1">Voeg je eerste private asset toe met de knop hierboven.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI's: Totaal overzicht */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" /> Private waarde
                </div>
                <p className="text-xl font-semibold tabular-nums">{fmt(metrics.totalCurrentValue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{privatePct.toFixed(1)}% van totaal</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" /> Ongerealiseerd P/L
                </div>
                <p className={cn("text-xl font-semibold tabular-nums", metrics.unrealizedPnl >= 0 ? "text-positive" : "text-negative")}>
                  {fmt(metrics.unrealizedPnl)}
                  <span className="text-sm font-normal ml-1">({metrics.unrealizedPnlPct >= 0 ? "+" : ""}{metrics.unrealizedPnlPct.toFixed(1)}%)</span>
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Wallet className="h-4 w-4" /> Private cashflow/jr
                </div>
                <p className="text-xl font-semibold tabular-nums">{fmt(metrics.totalAnnualCashflow)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{privateIncomePct.toFixed(1)}% van totaal income</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Lock className="h-4 w-4" /> Illiquid exposure
                </div>
                <p className="text-xl font-semibold tabular-nums">{privatePct.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Income split */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChart className="h-4 w-4" /> Income Split (Public vs Private)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${100 - privateIncomePct}%` }}
                  />
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${privateIncomePct}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Public: {fmt(publicIncome)} ({(100 - privateIncomePct).toFixed(1)}%)</span>
                <span>Private: {fmt(metrics.totalAnnualCashflow)} ({privateIncomePct.toFixed(1)}%)</span>
              </div>
            </CardContent>
          </Card>

          {/* Investments list */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Overzicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {investments.map((inv) => {
                  const value = inv.current_value ?? inv.invested_amount;
                  const pnl = value - inv.invested_amount;
                  const pnlPct = inv.invested_amount > 0 ? (pnl / inv.invested_amount) * 100 : 0;

                  return (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{inv.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-xs">{ASSET_TYPE_LABELS[inv.asset_type] ?? inv.asset_type}</Badge>
                            {inv.sector_label && <Badge variant="secondary" className="text-xs">{inv.sector_label}</Badge>}
                            {inv.geography_label && <span className="text-xs text-muted-foreground">{inv.geography_label}</span>}
                            {inv.has_loan && (
                              <Badge variant="outline" className="text-xs gap-0.5">
                                <Landmark className="h-3 w-3" /> Lening {inv.loan_amount ? fmt(inv.loan_amount) : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div>
                          <p className="text-sm tabular-nums font-medium">{fmt(value)}</p>
                          {inv.annual_cashflow > 0 && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {fmt(inv.annual_cashflow)}/jr ({FREQ_LABELS[inv.cashflow_frequency] ?? inv.cashflow_frequency})
                            </p>
                          )}
                        </div>
                        <span className={cn("text-xs tabular-nums w-16 text-right", pnl >= 0 ? "text-positive" : "text-negative")}>
                          {inv.current_value != null ? `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "—"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(inv.id, inv.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

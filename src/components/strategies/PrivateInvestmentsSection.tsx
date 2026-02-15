import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Building2, DollarSign, TrendingUp, Wallet, PieChart, Lock, Landmark, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrivateInvestment, useDeletePrivateInvestment, usePrivateInvestmentMetrics } from "@/hooks/usePrivateInvestments";
import { AddPrivateInvestmentDialog } from "./AddPrivateInvestmentDialog";
import { EditPrivateInvestmentDialog } from "./EditPrivateInvestmentDialog";
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
  const [editingInvestment, setEditingInvestment] = useState<PrivateInvestment | null>(null);

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
          {(() => {
            const totalLoanStart = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_amount ?? 0) : 0), 0);
            const totalLoanCurrent = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_current_balance ?? i.loan_amount ?? 0) : 0), 0);
            const totalEquityInvested = metrics.totalInvested - totalLoanStart;
            const totalEquityCurrent = metrics.totalCurrentValue - totalLoanCurrent;
            const roeTotal = totalEquityInvested > 0 ? ((totalEquityCurrent - totalEquityInvested) / totalEquityInvested) * 100 : 0;
            const totalLoanCosts = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_monthly_payment ?? 0) * 12 : 0), 0);
            const netYieldEV = totalEquityCurrent > 0 ? ((metrics.totalAnnualCashflow - totalLoanCosts) / totalEquityCurrent) * 100 : 0;

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                      <TrendingUp className="h-4 w-4" /> Eigen Vermogen
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{fmt(totalEquityCurrent)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Inleg EV: {fmt(totalEquityInvested)}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" /> ROE
                    </div>
                    <p className={cn("text-xl font-semibold tabular-nums", roeTotal >= 0 ? "text-positive" : "text-negative")}>
                      {roeTotal >= 0 ? "+" : ""}{roeTotal.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Netto yield: {netYieldEV.toFixed(1)}%/jr</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Wallet className="h-4 w-4" /> Netto cashflow/mnd
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{fmt((metrics.totalAnnualCashflow - totalLoanCosts) / 12)}</p>
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
            );
          })()}

          {/* Rendement op Eigen Vermogen */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Rendement op Eigen Vermogen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 font-medium">Investering</th>
                      <th className="text-right py-2 font-medium">Inleg</th>
                      <th className="text-right py-2 font-medium">Start lening</th>
                      <th className="text-right py-2 font-medium">Huidige lening</th>
                      <th className="text-right py-2 font-medium">Eigen Vermogen</th>
                      <th className="text-right py-2 font-medium">Waarde</th>
                      <th className="text-right py-2 font-medium">ROE</th>
                      <th className="text-right py-2 font-medium">Netto cashflow/mnd</th>
                      <th className="text-right py-2 font-medium">Netto Yield EV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => {
                      const loanStart = inv.has_loan ? (inv.loan_amount ?? 0) : 0;
                      const loanCurrent = inv.has_loan ? (inv.loan_current_balance ?? inv.loan_amount ?? 0) : 0;
                      const equityInvested = inv.invested_amount - loanStart;
                      const currentValue = inv.current_value ?? inv.invested_amount;
                      const equityCurrent = currentValue - loanCurrent;
                      const roe = equityInvested > 0 ? ((equityCurrent - equityInvested) / equityInvested) * 100 : 0;
                      const annualLoanCost = inv.has_loan ? (inv.loan_monthly_payment ?? 0) * 12 : 0;
                      const netCashflow = inv.annual_cashflow - annualLoanCost;
                      const netYieldOnEquity = equityInvested > 0 ? (netCashflow / equityInvested) * 100 : 0;

                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-2 font-medium truncate max-w-[140px]">{inv.name}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(inv.invested_amount)}</td>
                          <td className="py-2 text-right tabular-nums">{loanStart > 0 ? fmt(loanStart) : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{loanCurrent > 0 ? fmt(loanCurrent) : "—"}</td>
                          <td className="py-2 text-right tabular-nums font-medium">{fmt(equityCurrent)}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(currentValue)}</td>
                          <td className={cn("py-2 text-right tabular-nums", roe >= 0 ? "text-positive" : "text-negative")}>
                            {inv.current_value != null ? `${roe >= 0 ? "+" : ""}${roe.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">{fmt(netCashflow / 12)}</td>
                          <td className={cn("py-2 text-right tabular-nums font-medium", netYieldOnEquity >= 0 ? "text-positive" : "text-negative")}>
                            {equityInvested > 0 ? `${netYieldOnEquity.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {investments.length > 1 && (
                    <tfoot>
                      {(() => {
                        const tLoanStart = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_amount ?? 0) : 0), 0);
                        const tLoanCurrent = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_current_balance ?? i.loan_amount ?? 0) : 0), 0);
                        const tEquityInvested = metrics.totalInvested - tLoanStart;
                        const tEquityCurrent = metrics.totalCurrentValue - tLoanCurrent;
                        const tRoe = tEquityInvested > 0 ? ((tEquityCurrent - tEquityInvested) / tEquityInvested) * 100 : 0;
                        const tLoanCosts = investments.reduce((s, i) => s + (i.has_loan ? (i.loan_monthly_payment ?? 0) * 12 : 0), 0);
                        const tNetYield = tEquityInvested > 0 ? ((metrics.totalAnnualCashflow - tLoanCosts) / tEquityInvested) * 100 : 0;

                        return (
                          <tr className="border-t font-semibold text-xs">
                            <td className="py-2">Totaal</td>
                            <td className="py-2 text-right tabular-nums">{fmt(metrics.totalInvested)}</td>
                            <td className="py-2 text-right tabular-nums">{tLoanStart > 0 ? fmt(tLoanStart) : "—"}</td>
                            <td className="py-2 text-right tabular-nums">{tLoanCurrent > 0 ? fmt(tLoanCurrent) : "—"}</td>
                            <td className="py-2 text-right tabular-nums">{fmt(tEquityCurrent)}</td>
                            <td className="py-2 text-right tabular-nums">{fmt(metrics.totalCurrentValue)}</td>
                            <td className={cn("py-2 text-right tabular-nums", tRoe >= 0 ? "text-positive" : "text-negative")}>
                              {`${tRoe >= 0 ? "+" : ""}${tRoe.toFixed(1)}%`}
                            </td>
                            <td className="py-2 text-right tabular-nums">{fmt((metrics.totalAnnualCashflow - tLoanCosts) / 12)}</td>
                            <td className="py-2 text-right tabular-nums font-medium">{`${tNetYield.toFixed(1)}%`}</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

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
                          {(() => {
                            const monthlyCashflow = inv.annual_cashflow / 12;
                            const monthlyLoanCost = inv.has_loan ? (inv.loan_monthly_payment ?? 0) : 0;
                            const netMonthly = monthlyCashflow - monthlyLoanCost;
                            return monthlyCashflow > 0 ? (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {fmt(netMonthly)}/mnd netto
                              </p>
                            ) : null;
                          })()}
                        </div>
                        <span className={cn("text-xs tabular-nums w-16 text-right", pnl >= 0 ? "text-positive" : "text-negative")}>
                          {inv.current_value != null ? `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "—"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setEditingInvestment(inv)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
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

          {editingInvestment && (
            <EditPrivateInvestmentDialog
              investment={editingInvestment}
              open={!!editingInvestment}
              onOpenChange={(open) => { if (!open) setEditingInvestment(null); }}
            />
          )}
        </>
      )}
    </div>
  );
}

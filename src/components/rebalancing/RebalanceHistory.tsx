import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { History, ChevronDown, ChevronUp, FileDown, Calendar } from "lucide-react";
import { useRebalanceHistory } from "@/hooks/useRebalanceHistory";
import { downloadRebalancePdf } from "@/lib/rebalancePdf";

const goalLabels: Record<string, string> = {
  dividend: "Dividend / Inkomen",
  growth: "Groei",
  balanced: "Gebalanceerd",
  capital_preservation: "Kapitaalbehoud",
};

export function RebalanceHistory() {
  const { data: history, isLoading } = useRebalanceHistory();
  const [openId, setOpenId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Vorige adviezen
                <Badge variant="secondary" className="text-xs">{history.length}</Badge>
              </span>
              {panelOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {history.map((item) => {
              const isOpen = openId === item.id;
              const date = new Date(item.created_at);
              const fmtDate = date.toLocaleDateString("nl-NL", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const adjustCounts = {
                increase: item.proposal.adjustments?.filter((a) => a.action === "increase").length ?? 0,
                decrease: item.proposal.adjustments?.filter((a) => a.action === "decrease").length ?? 0,
                sell: item.proposal.adjustments?.filter((a) => a.action === "sell").length ?? 0,
              };

              return (
                <Collapsible key={item.id} open={isOpen} onOpenChange={(v) => setOpenId(v ? item.id : null)}>
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {goalLabels[item.preferences.primaryGoal] ?? item.preferences.primaryGoal}
                            </p>
                            <p className="text-xs text-muted-foreground">{fmtDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {adjustCounts.increase > 0 && (
                            <Badge variant="default" className="text-xs">+{adjustCounts.increase}</Badge>
                          )}
                          {adjustCounts.decrease > 0 && (
                            <Badge variant="secondary" className="text-xs">−{adjustCounts.decrease}</Badge>
                          )}
                          {adjustCounts.sell > 0 && (
                            <Badge variant="destructive" className="text-xs">v{adjustCounts.sell}</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadRebalancePdf(item.proposal, item.preferences, item.created_at);
                            }}
                            title="Download als PDF"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t px-3 py-3 bg-muted/10 space-y-3">
                        {/* Summary preview */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Samenvatting</p>
                          <p className="text-xs text-foreground leading-relaxed line-clamp-4">
                            {item.proposal.summary}
                          </p>
                        </div>

                        {/* Top adjustments */}
                        {item.proposal.adjustments?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Grootste aanpassingen
                            </p>
                            <div className="space-y-1">
                              {item.proposal.adjustments
                                .filter((a) => a.action !== "hold")
                                .slice(0, 4)
                                .map((a, i) => {
                                  const delta = a.suggestedWeight - a.currentWeight;
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <span className="font-medium">{a.ticker}</span>
                                      <span className={
                                        delta > 0
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-red-600 dark:text-red-400"
                                      }>
                                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* PDF button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => downloadRebalancePdf(item.proposal, item.preferences, item.created_at)}
                        >
                          <FileDown className="h-3 w-3 mr-1.5" />
                          Download PDF
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

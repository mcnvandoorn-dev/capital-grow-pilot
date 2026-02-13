import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, Minus, TrendingUp, Shield, Sparkles } from "lucide-react";

export interface RebalanceProposal {
  summary: string;
  riskAnalysis: {
    overweightSectors: string[];
    underweightSectors: string[];
    concentrationRisks: string[];
    yieldTrapWarnings: string[];
    correlationRisks: string[];
    currencyRisks: string[];
  };
  adjustments: {
    ticker: string;
    name: string | null;
    currentWeight: number;
    suggestedWeight: number;
    action: "increase" | "decrease" | "hold" | "sell" | "new";
    reasoning: string;
  }[];
  sectorShifts: {
    sector: string;
    currentWeight: number;
    suggestedWeight: number;
  }[];
  replacements: {
    sellTicker: string;
    sellReason: string;
    buyTicker: string;
    buyReason: string;
  }[];
  additionalInsights: string;
}

interface RebalanceResultsProps {
  proposal: RebalanceProposal;
}

function fmt(v: number) {
  return `${v.toFixed(1)}%`;
}

export function RebalanceResults({ proposal }: RebalanceResultsProps) {
  const { riskAnalysis, adjustments, sectorShifts, replacements } = proposal;

  // Before/after sector data for chart
  const sectorChartData = sectorShifts.map((s) => ({
    sector: s.sector,
    Huidig: parseFloat(s.currentWeight.toFixed(1)),
    Voorstel: parseFloat(s.suggestedWeight.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analyse Samenvatting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground">
            {proposal.summary.split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <p key={i} className="text-sm text-muted-foreground ml-2 mb-0.5">
                    • {line.slice(2)}
                  </p>
                );
              }
              return (
                <p key={i} className="text-sm text-muted-foreground mb-1">{line}</p>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Risk analysis */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risicoanalyse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {riskAnalysis.overweightSectors.length > 0 && (
            <RiskSection
              label="Overwogen sectoren"
              items={riskAnalysis.overweightSectors}
              variant="warning"
            />
          )}
          {riskAnalysis.underweightSectors.length > 0 && (
            <RiskSection
              label="Onderwogen sectoren"
              items={riskAnalysis.underweightSectors}
              variant="info"
            />
          )}
          {riskAnalysis.concentrationRisks.length > 0 && (
            <RiskSection
              label="Concentratierisico's"
              items={riskAnalysis.concentrationRisks}
              variant="danger"
            />
          )}
          {riskAnalysis.yieldTrapWarnings.length > 0 && (
            <RiskSection
              label="Yield trap waarschuwingen"
              items={riskAnalysis.yieldTrapWarnings}
              variant="danger"
            />
          )}
          {riskAnalysis.correlationRisks.length > 0 && (
            <RiskSection
              label="Correlatierisico's"
              items={riskAnalysis.correlationRisks}
              variant="warning"
            />
          )}
          {riskAnalysis.currencyRisks.length > 0 && (
            <RiskSection
              label="Valutarisico's"
              items={riskAnalysis.currencyRisks}
              variant="info"
            />
          )}
        </CardContent>
      </Card>

      {/* Sector shifts chart */}
      {sectorChartData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Sectorverdeling: Huidig vs Voorstel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(250, sectorChartData.length * 40)}>
              <BarChart data={sectorChartData} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} className="text-xs" />
                <YAxis type="category" dataKey="sector" width={130} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => `${value}%`}
                  contentStyle={{ fontSize: "0.75rem" }}
                />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                <Bar dataKey="Huidig" fill="hsl(220, 60%, 45%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Voorstel" fill="hsl(152, 50%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weight adjustments table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Gewichtsaanpassingen
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Dit zijn suggesties — er worden geen transacties automatisch uitgevoerd.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Actie</TableHead>
                <TableHead className="text-right">Huidig</TableHead>
                <TableHead className="text-right">Voorstel</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead>Reden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj, i) => {
                const delta = adj.suggestedWeight - adj.currentWeight;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-medium">{adj.ticker}</span>
                      {adj.name && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[140px]">
                          {adj.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={adj.action} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{fmt(adj.currentWeight)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(adj.suggestedWeight)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      <span className={delta > 0 ? "text-green-600 dark:text-green-400" : delta < 0 ? "text-red-600 dark:text-red-400" : ""}>
                        {delta > 0 ? "+" : ""}{fmt(delta)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{adj.reasoning}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ticker replacements */}
      {replacements.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Mogelijke Ticker Vervangingen</CardTitle>
            <p className="text-xs text-muted-foreground">
              Suggesties ter overweging — doe altijd eigen onderzoek.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {replacements.map((r, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="destructive" className="text-xs">Verkoop</Badge>
                  <span className="font-medium text-sm">{r.sellTicker}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Badge variant="default" className="text-xs">Koop</Badge>
                  <span className="font-medium text-sm">{r.buyTicker}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Verkoop:</strong> {r.sellReason}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Koop:</strong> {r.buyReason}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Additional insights */}
      {proposal.additionalInsights && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Aanvullende Inzichten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              {proposal.additionalInsights.split("\n").map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                if (line.startsWith("##")) {
                  return (
                    <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
                      {line.replace(/^#+\s*/, "")}
                    </h3>
                  );
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <p key={i} className="text-sm text-muted-foreground ml-2 mb-0.5">
                      • {line.slice(2)}
                    </p>
                  );
                }
                return <p key={i} className="text-sm text-muted-foreground mb-1">{line}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    increase: { label: "Verhogen", variant: "default", icon: <ArrowUp className="h-3 w-3" /> },
    decrease: { label: "Verlagen", variant: "secondary", icon: <ArrowDown className="h-3 w-3" /> },
    hold: { label: "Houden", variant: "outline", icon: <Minus className="h-3 w-3" /> },
    sell: { label: "Verkopen", variant: "destructive", icon: <ArrowDown className="h-3 w-3" /> },
    new: { label: "Nieuw", variant: "default", icon: <ArrowUp className="h-3 w-3" /> },
  };
  const m = map[action] ?? map.hold;
  return (
    <Badge variant={m.variant} className="text-xs gap-1">
      {m.icon} {m.label}
    </Badge>
  );
}

function RiskSection({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: "danger" | "warning" | "info";
}) {
  const colors = {
    danger: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className={`h-3.5 w-3.5 ${colors[variant]}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ul className="ml-6 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

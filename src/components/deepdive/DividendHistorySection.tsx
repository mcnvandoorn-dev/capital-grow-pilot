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
} from "recharts";
import type { TickerDetail } from "@/hooks/useTickerDetail";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

interface DividendHistorySectionProps {
  dividends: TickerDetail["dividends"];
  fundamentals: TickerDetail["fundamentals"];
}

export function DividendHistorySection({ dividends, fundamentals }: DividendHistorySectionProps) {
  // Aggregate dividends by year for chart
  const byYear: Record<string, { regular: number; roc: number }> = {};
  for (const d of dividends) {
    const year = d.ex_date.slice(0, 4);
    if (!byYear[year]) byYear[year] = { regular: 0, roc: 0 };
    if (d.is_roc) {
      byYear[year].roc += d.net_amount;
    } else {
      byYear[year].regular += d.net_amount;
    }
  }
  const chartData = Object.entries(byYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, vals]) => ({ year, ...vals, total: vals.regular + vals.roc }));

  // Sustainability metrics
  const totalDivs = dividends.length;
  const rocCount = dividends.filter((d) => d.is_roc).length;
  const rocPct = totalDivs > 0 ? (rocCount / totalDivs) * 100 : 0;

  const sustainabilityMetrics = [
    { label: "Dividend Yield", value: fundamentals?.dividend_yield != null ? `${(fundamentals.dividend_yield * 100).toFixed(2)}%` : "—" },
    { label: "Payout Ratio", value: fundamentals?.payout_ratio != null ? `${fundamentals.payout_ratio.toFixed(1)}%` : "—" },
    { label: "Div. CAGR (5j)", value: fundamentals?.dividend_cagr_5y != null ? `${(fundamentals.dividend_cagr_5y * 100).toFixed(1)}%` : "—" },
    { label: "ROC %", value: `${rocPct.toFixed(1)}%`, warn: rocPct > 30 },
    { label: "Totaal uitkeringen", value: String(totalDivs) },
  ];

  return (
    <div className="space-y-6">
      {/* Sustainability metrics */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Dividend Duurzaamheid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sustainabilityMetrics.map((m) => (
              <div key={m.label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${m.warn ? "text-amber-600 dark:text-amber-400" : ""}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Annual chart */}
      {chartData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Jaarlijks Dividend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis tickFormatter={(v) => `€${v.toFixed(0)}`} className="text-xs" width={55} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "regular" ? "Regulier" : "ROC",
                  ]}
                  contentStyle={{ fontSize: "0.75rem" }}
                />
                <Bar dataKey="regular" stackId="a" fill="hsl(152, 50%, 45%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="roc" stackId="a" fill="hsl(38, 80%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Dividend table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Dividendhistorie</CardTitle>
        </CardHeader>
        <CardContent>
          {dividends.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Geen dividenddata beschikbaar.
            </p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ex-datum</TableHead>
                    <TableHead className="text-right">Per aandeel</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Belasting</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividends.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        {new Date(d.ex_date).toLocaleDateString("nl-NL")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(d.amount_per_share)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(d.total_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(d.net_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(d.withholding_tax)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.is_roc ? "outline" : "secondary"} className="text-xs">
                          {d.is_roc ? "ROC" : "Dividend"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

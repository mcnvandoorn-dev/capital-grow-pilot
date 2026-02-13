import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PositionWeight } from "@/hooks/usePortfolioBreakdown";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface PositionWeightsTableProps {
  positions: PositionWeight[];
}

export function PositionWeightsTable({ positions }: PositionWeightsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Geen posities beschikbaar
      </div>
    );
  }

  const maxPct = Math.max(...positions.map((p) => p.percentage));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Sector</TableHead>
          <TableHead className="text-right">Waarde</TableHead>
          <TableHead className="text-right w-24">Gewicht</TableHead>
          <TableHead className="w-32"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((pos) => (
          <TableRow key={pos.ticker}>
            <TableCell>
              <div>
                <span className="font-medium">{pos.ticker}</span>
                {pos.name && (
                  <span className="block text-xs text-muted-foreground truncate max-w-[180px]">
                    {pos.name}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {pos.assetClass}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {pos.sector ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {formatCurrency(pos.marketValue)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium text-sm">
              {pos.percentage.toFixed(1)}%
            </TableCell>
            <TableCell>
              <Progress
                value={(pos.percentage / maxPct) * 100}
                className="h-1.5"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

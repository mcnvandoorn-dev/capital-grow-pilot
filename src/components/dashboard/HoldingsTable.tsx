import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";

interface HoldingsTableProps {
  positions: PositionWithDetails[];
}

function formatCurrency(value: number | null, currency = "EUR") {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number | null) {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function HoldingsTable({ positions }: HoldingsTableProps) {
  const navigate = useNavigate();
  const sorted = [...positions].sort((a, b) => {
    const aVal = a.market_value ?? 0;
    const bVal = b.market_value ?? 0;
    return bVal - aVal;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[90px]">Ticker</TableHead>
          <TableHead>Naam</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Aantal</TableHead>
          <TableHead className="text-right">Koers</TableHead>
          <TableHead className="text-right">Waarde</TableHead>
          <TableHead className="text-right">P/L</TableHead>
          <TableHead className="text-right">P/L %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((pos) => (
          <TableRow key={pos.id} className="cursor-pointer hover:bg-muted/50">
            <TableCell className="font-mono text-sm font-medium">
              {pos.security.ticker}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">
              {pos.security.name ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs font-normal">
                {pos.security.asset_class}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {pos.quantity.toLocaleString("nl-NL")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(pos.market_price, pos.security.currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(pos.market_value, pos.currency)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                pos.unrealized_pnl !== null && pos.unrealized_pnl >= 0
                  ? "text-positive"
                  : "text-negative"
              )}
            >
              {formatCurrency(pos.unrealized_pnl, pos.currency)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                pos.unrealized_pnl_pct !== null && pos.unrealized_pnl_pct >= 0
                  ? "text-positive"
                  : "text-negative"
              )}
            >
              {formatPct(pos.unrealized_pnl_pct)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

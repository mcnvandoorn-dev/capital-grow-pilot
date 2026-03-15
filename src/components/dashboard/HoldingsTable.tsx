import { useState, useMemo, useCallback } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { PositionWithDetails } from "@/hooks/usePortfolioData";

interface HoldingsTableProps {
  positions: PositionWithDetails[];
  /** Map of security_id → forward annual dividend per share */
  dividendPerShareMap?: Map<string, number>;
}

type SortKey = "ticker" | "name" | "type" | "quantity" | "price" | "value" | "yoc" | "pnl" | "pnlPct";
type SortDir = "asc" | "desc";

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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
  tooltip,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  tooltip?: string;
}) {
  const content = (
    <button
      type="button"
      className={cn("inline-flex items-center hover:text-foreground transition-colors cursor-pointer select-none", className)}
      onClick={() => onSort(sortKey)}
    >
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="border-b border-dotted border-muted-foreground">{label}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-[200px]">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        label
      )}
      <SortIcon active={currentKey === sortKey} dir={currentDir} />
    </button>
  );
  return content;
}

interface BuyTransaction {
  id: string;
  trade_date: string;
  quantity: number;
  price: number;
  currency: string;
}

function ExpandedYoCRows({
  pos,
  divPerShare,
}: {
  pos: PositionWithDetails;
  divPerShare: number | null;
}) {
  const { data: buyTxs, isLoading } = useQuery({
    queryKey: ["buy-transactions", pos.portfolio_id, pos.security_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, trade_date, quantity, price, currency")
        .eq("portfolio_id", pos.portfolio_id)
        .eq("security_id", pos.security_id)
        .eq("transaction_type", "BUY")
        .order("trade_date", { ascending: true });
      if (error) throw error;
      return data as BuyTransaction[];
    },
  });

  if (isLoading) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-3">
          Laden...
        </TableCell>
      </TableRow>
    );
  }

  if (!buyTxs || buyTxs.length === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-3">
          Geen kooptransacties gevonden
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {buyTxs.map((tx) => {
        const txYoC = divPerShare !== null && tx.price > 0
          ? (divPerShare / tx.price) * 100
          : null;

        return (
          <TableRow key={tx.id} className="bg-muted/30 hover:bg-muted/50">
            <TableCell className="pl-10 text-xs text-muted-foreground font-mono">
              ↳
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(tx.trade_date).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
            </TableCell>
            <TableCell />
            <TableCell className="text-right tabular-nums text-xs">
              {tx.quantity.toLocaleString("nl-NL")}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs">
              {formatCurrency(tx.price, tx.currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
              {formatCurrency(tx.price * tx.quantity, tx.currency)}
            </TableCell>
            <TableCell className={cn(
              "text-right tabular-nums text-xs font-medium",
              txYoC !== null && txYoC >= 8 ? "text-primary" : ""
            )}>
              {txYoC !== null ? `${txYoC.toFixed(1)}%` : "—"}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        );
      })}
    </>
  );
}

export function HoldingsTable({ positions, dividendPerShareMap }: HoldingsTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const getYoC = useCallback((pos: PositionWithDetails) => {
    const divPerShare = dividendPerShareMap?.get(pos.security_id) ?? null;
    return divPerShare !== null && pos.avg_cost_basis > 0
      ? (divPerShare / pos.avg_cost_basis) * 100
      : null;
  }, [dividendPerShareMap]);

  const sorted = useMemo(() => {
    const arr = [...positions];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      let aVal: string | number | null = 0;
      let bVal: string | number | null = 0;

      switch (sortKey) {
        case "ticker":
          return dir * (a.security.ticker ?? "").localeCompare(b.security.ticker ?? "");
        case "name":
          return dir * (a.security.name ?? "").localeCompare(b.security.name ?? "");
        case "type":
          return dir * (a.security.asset_class ?? "").localeCompare(b.security.asset_class ?? "");
        case "quantity":
          return dir * (a.quantity - b.quantity);
        case "price":
          aVal = a.market_price ?? 0;
          bVal = b.market_price ?? 0;
          return dir * (aVal - bVal);
        case "value":
          aVal = a.market_value ?? 0;
          bVal = b.market_value ?? 0;
          return dir * (aVal - bVal);
        case "yoc":
          aVal = getYoC(a) ?? -Infinity;
          bVal = getYoC(b) ?? -Infinity;
          return dir * ((aVal as number) - (bVal as number));
        case "pnl":
          aVal = a.unrealized_pnl ?? 0;
          bVal = b.unrealized_pnl ?? 0;
          return dir * (aVal - bVal);
        case "pnlPct":
          aVal = a.unrealized_pnl_pct ?? 0;
          bVal = b.unrealized_pnl_pct ?? 0;
          return dir * (aVal - bVal);
        default:
          return 0;
      }
    });
    return arr;
  }, [positions, sortKey, sortDir, getYoC]);

  const headProps = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[90px]">
            <SortableHead label="Ticker" sortKey="ticker" {...headProps} />
          </TableHead>
          <TableHead>
            <SortableHead label="Naam" sortKey="name" {...headProps} />
          </TableHead>
          <TableHead>
            <SortableHead label="Type" sortKey="type" {...headProps} />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead label="Aantal" sortKey="quantity" {...headProps} className="justify-end" />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead label="Koers" sortKey="price" {...headProps} className="justify-end" />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead label="Waarde" sortKey="value" {...headProps} className="justify-end" />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead
              label="YoC"
              sortKey="yoc"
              {...headProps}
              className="justify-end"
              tooltip="Yield on Cost: (jaarlijks dividend per aandeel / gemiddelde aankoopprijs) × 100%"
            />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead label="P/L" sortKey="pnl" {...headProps} className="justify-end" />
          </TableHead>
          <TableHead className="text-right">
            <SortableHead label="P/L %" sortKey="pnlPct" {...headProps} className="justify-end" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((pos) => {
          const yoc = getYoC(pos);
          const isExpanded = expandedIds.has(pos.id);
          const divPerShare = dividendPerShareMap?.get(pos.security_id) ?? null;

          return (
            <>
              <TableRow key={pos.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ticker-deep-dive?security=${pos.security_id}`)}>
                <TableCell className="font-mono text-sm font-medium">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => toggleExpanded(pos.id, e)}
                      className="p-0.5 rounded hover:bg-accent transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    {pos.security.ticker}
                  </div>
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
                <TableCell className={cn(
                  "text-right tabular-nums font-medium",
                  yoc !== null && yoc >= 8 ? "text-primary" : ""
                )}>
                  {yoc !== null ? `${yoc.toFixed(1)}%` : "—"}
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
              {isExpanded && (
                <ExpandedYoCRows pos={pos} divPerShare={divPerShare} />
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

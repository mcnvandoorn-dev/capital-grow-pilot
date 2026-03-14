import { AppLayout } from "@/components/layout/AppLayout";
import { useDividendCalendar, CalendarDividend } from "@/hooks/useDividendCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, TrendingUp, DollarSign, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";

const monthNames = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(val);
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const variant = confidence === "high" ? "default" : confidence === "medium" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="text-xs capitalize">
      {confidence === "high" ? "Hoog" : confidence === "medium" ? "Gemiddeld" : "Laag"}
    </Badge>
  );
}

function MonthCard({ monthKey, events }: { monthKey: string; events: CalendarDividend[] }) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthName = monthNames[month - 1];
  const totalEstimated = events.reduce((s, e) => s + e.estimatedTotal, 0);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  return (
    <Card className={isCurrentMonth ? "border-primary/40 shadow-md" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {monthName} {year}
            {isCurrentMonth && (
              <Badge variant="default" className="text-[10px] ml-1">Nu</Badge>
            )}
          </CardTitle>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{formatCurrency(totalEstimated)}</p>
            <p className="text-[11px] text-muted-foreground">{events.length} dividend{events.length !== 1 ? "en" : ""}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs">Ticker</TableHead>
              <TableHead className="h-8 text-xs">Ex-date</TableHead>
              <TableHead className="h-8 text-xs">Pay-date</TableHead>
              <TableHead className="h-8 text-xs text-right">Per aandeel</TableHead>
              <TableHead className="h-8 text-xs text-right">Geschat totaal</TableHead>
              <TableHead className="h-8 text-xs text-center">Zekerheid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev, i) => (
              <TableRow key={`${ev.securityId}-${ev.expectedExDate}-${i}`}>
                <TableCell className="py-2 font-medium">{ev.ticker}</TableCell>
                <TableCell className="py-2 text-muted-foreground text-sm">{formatDate(ev.expectedExDate)}</TableCell>
                <TableCell className="py-2 text-muted-foreground text-sm">
                  {ev.expectedPayDate ? formatDate(ev.expectedPayDate) : "—"}
                </TableCell>
                <TableCell className="py-2 text-right text-sm">
                  ${ev.amountPerShare.toFixed(4)}
                </TableCell>
                <TableCell className="py-2 text-right font-medium text-sm">
                  {formatCurrency(ev.estimatedTotal)}
                </TableCell>
                <TableCell className="py-2 text-center">
                  <ConfidenceBadge confidence={ev.confidence} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function DividendCalendar() {
  const { calendarEvents, byMonth, isLoading } = useDividendCalendar();

  const totalExpected = useMemo(
    () => calendarEvents.reduce((s, e) => s + e.estimatedTotal, 0),
    [calendarEvents]
  );
  const uniqueTickers = useMemo(
    () => new Set(calendarEvents.map((e) => e.ticker)).size,
    [calendarEvents]
  );
  const monthKeys = useMemo(() => Array.from(byMonth.keys()).sort(), [byMonth]);

  return (
    <AppLayout title="Dividend Kalender" subtitle="Verwachte ex-dates en pay-dates">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dividend Kalender</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            Verwachte ex-dates en pay-dates op basis van je huidige posities en historische data
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">
                  Projecties zijn gebaseerd op het laatste ontvangen dividend en de bekende frequentie.
                  Werkelijke data en bedragen kunnen afwijken.
                </p>
              </TooltipContent>
            </Tooltip>
          </p>
        </div>

        {/* KPI strip */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Verwacht (12 mnd)</p>
                  <p className="text-xl font-bold">{formatCurrency(totalExpected)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Verwachte uitkeringen</p>
                  <p className="text-xl font-bold">{calendarEvents.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gem. per maand</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(monthKeys.length > 0 ? totalExpected / monthKeys.length : 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly cards */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : monthKeys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Geen dividendhistorie gevonden om projecties te maken.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {monthKeys.map((key) => (
              <MonthCard key={key} monthKey={key} events={byMonth.get(key)!} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

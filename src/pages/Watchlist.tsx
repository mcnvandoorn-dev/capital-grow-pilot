import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Plus, Search } from "lucide-react";

const Watchlist = () => {
  return (
    <AppLayout
      title="Watchlist"
      subtitle="Volg bedrijven en hun fundamentele indicatoren"
      actions={
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Bedrijf toevoegen
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Zoek op ticker of naam..." className="pl-9" />
        </div>
        <Select>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Asset class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CEF">CEF</SelectItem>
            <SelectItem value="BDC">BDC</SelectItem>
            <SelectItem value="REIT">REIT</SelectItem>
            <SelectItem value="ETF">ETF</SelectItem>
            <SelectItem value="PREFERRED">Preferred</SelectItem>
            <SelectItem value="BABY_BOND">Baby Bond</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle sectoren</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Watchlist table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Gevolgde bedrijven
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* When populated, render this table */}
          <div className="hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ticker</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Koers</TableHead>
                  <TableHead className="text-right">P/E</TableHead>
                  <TableHead className="text-right">Div. Yield</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium font-mono text-sm">AAPL</TableCell>
                  <TableCell>Apple Inc.</TableCell>
                  <TableCell className="text-muted-foreground">Technology</TableCell>
                  <TableCell className="text-right tabular-nums">$189.25</TableCell>
                  <TableCell className="text-right tabular-nums">28.4</TableCell>
                  <TableCell className="text-right tabular-nums">0.56%</TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge score={72} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Empty state */}
          <EmptyState
            icon={Eye}
            title="Je watchlist is leeg"
            description="Voeg bedrijven toe om hun koersen, fundamentele data en scores te volgen."
            action={
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Eerste bedrijf toevoegen
              </Button>
            }
          />
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Watchlist;

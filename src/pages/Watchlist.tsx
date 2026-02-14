import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Plus, Search, Trash2, Upload, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  useWatchlist,
  useAddToWatchlist,
  useBulkAddToWatchlist,
  useRemoveFromWatchlist,
} from "@/hooks/useWatchlist";
import { useSecuritiesForSelect, useCreateAlert } from "@/hooks/useAlerts";
import type { Database } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";

type AlertType = Database["public"]["Enums"]["alert_type"];
type AlertCondition = Database["public"]["Enums"]["alert_condition"];

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  PRICE: "Prijs",
  DISCOUNT_TO_NAV: "Korting t.o.v. NAV",
  RSI: "RSI (14)",
  Z_SCORE: "Z-Score",
};

const CONDITION_LABELS: Record<AlertCondition, string> = {
  ABOVE: "Boven",
  BELOW: "Onder",
  CROSSES_ABOVE: "Kruist omhoog",
  CROSSES_BELOW: "Kruist omlaag",
};

const Watchlist = () => {
  const { data: watchlist, isLoading } = useWatchlist();
  const { data: securities } = useSecuritiesForSelect();
  const addToWatchlist = useAddToWatchlist();
  const bulkAdd = useBulkAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const createAlert = useCreateAlert();

  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [selectedSecurityId, setSelectedSecurityId] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("PRICE");
  const [alertCondition, setAlertCondition] = useState<AlertCondition>("BELOW");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertSecurityId, setAlertSecurityId] = useState("");
  const [alertTicker, setAlertTicker] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = watchlist?.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.securities?.ticker?.toLowerCase().includes(q) ||
      item.securities?.name?.toLowerCase().includes(q);
    const matchesAsset =
      assetFilter === "all" || item.securities?.asset_class === assetFilter;
    return matchesSearch && matchesAsset;
  });

  const handleAddSecurity = async () => {
    if (!selectedSecurityId) {
      toast.error("Selecteer een security.");
      return;
    }
    try {
      await addToWatchlist.mutateAsync(selectedSecurityId);
      toast.success("Toegevoegd aan watchlist");
      setAddDialogOpen(false);
      setSelectedSecurityId("");
    } catch {
      toast.error("Kon niet toevoegen. Mogelijk al op je watchlist.");
    }
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Try multiple parsing strategies
        // Strategy 1: row-array mode
        const rowArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        // Strategy 2: also try named-column mode to find "ticker"/"symbol" column
        const namedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: "",
        });

        const tickers: string[] = [];

        // First try named columns
        if (namedRows.length > 0) {
          const keys = Object.keys(namedRows[0]);
          const tickerKey = keys.find((k) =>
            /^(ticker|symbol|code|isin)$/i.test(k.trim())
          ) || keys[0]; // fall back to first column

          for (const row of namedRows) {
            const val = String(row[tickerKey] ?? "").trim().toUpperCase();
            if (val && val !== "#VALUE!" && val.length <= 20) {
              tickers.push(val);
            }
          }
        }

        // If named approach yielded nothing, try array approach
        if (tickers.length === 0) {
          for (const row of rowArrays) {
            if (!Array.isArray(row) || row.length === 0) continue;
            // Try each column to find ticker-like values
            for (const cell of row) {
              const val = String(cell ?? "").trim().toUpperCase();
              if (
                val &&
                val !== "#VALUE!" &&
                val.length >= 1 &&
                val.length <= 20 &&
                /^[A-Z0-9.\- ]+$/.test(val)
              ) {
                tickers.push(val);
                break; // take first matching cell per row
              }
            }
          }
        }

        // Remove likely header rows
        const headerPatterns = ["TICKER", "SYMBOL", "CODE", "NAAM", "NAME", "ISIN", "SECURITY"];
        const cleanedTickers = tickers.filter(
          (t) => !headerPatterns.includes(t)
        );

        if (cleanedTickers.length === 0) {
          toast.error(
            "Geen tickers gevonden. Zorg dat tickers in de eerste kolom staan."
          );
          return;
        }

        const result = await bulkAdd.mutateAsync(cleanedTickers);
        toast.success(
          `${result.added} ticker(s) toegevoegd, ${result.skipped} overgeslagen`
        );
        setUploadDialogOpen(false);
      } catch {
        toast.error("Fout bij het verwerken van het bestand.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [bulkAdd]
  );

  const handleRemove = async (id: string) => {
    try {
      await removeFromWatchlist.mutateAsync(id);
      toast.success("Verwijderd van watchlist");
    } catch {
      toast.error("Kon niet verwijderen.");
    }
  };

  const openAlertDialog = (securityId: string, ticker: string) => {
    setAlertSecurityId(securityId);
    setAlertTicker(ticker);
    setAlertType("PRICE");
    setAlertCondition("BELOW");
    setAlertThreshold("");
    setAlertDialogOpen(true);
  };

  const handleCreateAlert = async () => {
    if (!alertThreshold) {
      toast.error("Vul een drempelwaarde in.");
      return;
    }
    const val = parseFloat(alertThreshold);
    if (isNaN(val)) {
      toast.error("Drempelwaarde moet een getal zijn.");
      return;
    }
    try {
      await createAlert.mutateAsync({
        security_id: alertSecurityId,
        alert_type: alertType,
        condition: alertCondition,
        threshold: val,
        notes: null,
      });
      toast.success(`Alert voor ${alertTicker} aangemaakt`);
      setAlertDialogOpen(false);
    } catch {
      toast.error("Kon alert niet aanmaken.");
    }
  };

  return (
    <AppLayout
      title="Watchlist"
      subtitle="Volg bedrijven en stel automatische alerts in"
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Excel upload
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Bedrijf toevoegen
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op ticker of naam..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={assetFilter} onValueChange={setAssetFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Asset class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            <SelectItem value="CEF">CEF</SelectItem>
            <SelectItem value="BDC">BDC</SelectItem>
            <SelectItem value="REIT">REIT</SelectItem>
            <SelectItem value="ETF">ETF</SelectItem>
            <SelectItem value="PREFERRED">Preferred</SelectItem>
            <SelectItem value="BABY_BOND">Baby Bond</SelectItem>
            <SelectItem value="OTHER">Overig</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Watchlist table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Gevolgde bedrijven
            {filtered && filtered.length > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">
                ({filtered.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ticker</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-center">Alert</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium font-mono text-sm">
                      {item.securities?.ticker ?? "—"}
                    </TableCell>
                    <TableCell>
                      {item.securities?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.securities?.asset_class ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.securities?.sector ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() =>
                          openAlertDialog(
                            item.securities?.id ?? "",
                            item.securities?.ticker ?? ""
                          )
                        }
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Alert instellen"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Eye}
              title="Je watchlist is leeg"
              description="Voeg bedrijven toe of upload een Excel-bestand met tickers."
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Excel upload
                  </Button>
                  <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Bedrijf toevoegen
                  </Button>
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Add security dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bedrijf toevoegen</DialogTitle>
            <DialogDescription>
              Selecteer een security om aan je watchlist toe te voegen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label>Security</Label>
            <Select
              value={selectedSecurityId}
              onValueChange={setSelectedSecurityId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer..." />
              </SelectTrigger>
              <SelectContent>
                {securities?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-mono mr-2">{s.ticker}</span>
                    <span className="text-muted-foreground">{s.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddSecurity}
              disabled={addToWatchlist.isPending}
              className="w-full"
            >
              {addToWatchlist.isPending ? "Bezig..." : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel bestand uploaden</DialogTitle>
            <DialogDescription>
              Upload een Excel- of CSV-bestand met tickers in de eerste kolom.
              Eventuele headerrij wordt automatisch overgeslagen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
          {bulkAdd.isPending && (
            <p className="text-sm text-muted-foreground">Bezig met verwerken...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Alert instellen voor{" "}
              <span className="font-mono">{alertTicker}</span>
            </DialogTitle>
            <DialogDescription>
              Stel een automatisch alert in om meldingen te ontvangen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={alertType}
                  onValueChange={(v) => setAlertType(v as AlertType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(ALERT_TYPE_LABELS) as [AlertType, string][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conditie</Label>
                <Select
                  value={alertCondition}
                  onValueChange={(v) =>
                    setAlertCondition(v as AlertCondition)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(CONDITION_LABELS) as [
                        AlertCondition,
                        string,
                      ][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Drempelwaarde</Label>
              <Input
                type="number"
                step="any"
                placeholder="Bijv. 25.50"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateAlert}
              disabled={createAlert.isPending}
              className="w-full"
            >
              {createAlert.isPending ? "Bezig..." : "Alert aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Watchlist;

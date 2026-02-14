import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Eye, Plus, Search, Trash2, Upload, Bell, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useWatchlist,
  useAddToWatchlist,
  useBulkImportWatchlist,
  useRemoveFromWatchlist,
  lookupExistingTickers,
} from "@/hooks/useWatchlist";
import { useSecuritiesForSelect, useCreateAlert } from "@/hooks/useAlerts";
import type { Database } from "@/integrations/supabase/types";
import { generateImportPreview, getImportableTickers, type ImportResult } from "@/lib/importEngine";

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

const STATUS_CONFIG = {
  valid: { icon: CheckCircle2, label: "Geldig", className: "text-green-600 dark:text-green-400" },
  unknown: { icon: AlertTriangle, label: "Nieuw", className: "text-amber-600 dark:text-amber-400" },
  invalid: { icon: XCircle, label: "Ongeldig", className: "text-destructive" },
  duplicate: { icon: XCircle, label: "Dubbel", className: "text-muted-foreground" },
};

const Watchlist = () => {
  const { data: watchlist, isLoading } = useWatchlist();
  const { data: securities } = useSecuritiesForSelect();
  const addToWatchlist = useAddToWatchlist();
  const bulkImport = useBulkImportWatchlist();
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

  // Import preview state
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

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

  // Layer 4: Generate preview on file selection
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParsing(true);
      setImportPreview(null);

      try {
        const preview = await generateImportPreview(file, lookupExistingTickers);
        setImportPreview(preview);

        if (preview.tickers.length === 0 && preview.errors.length > 0) {
          toast.error(preview.errors[0]);
        }
      } catch (err) {
        toast.error(
          `Onverwachte fout: ${err instanceof Error ? err.message : "onbekend"}`
        );
      } finally {
        setParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  // Layer 5: Confirmed import
  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const importable = getImportableTickers(importPreview);
    if (importable.length === 0) {
      toast.error("Geen importeerbare tickers gevonden.");
      return;
    }

    try {
      const result = await bulkImport.mutateAsync(importable);
      toast.success(
        `${result.added} ticker(s) toegevoegd, ${result.skipped} overgeslagen`
      );
      setImportPreview(null);
      setUploadDialogOpen(false);
    } catch (err) {
      toast.error(
        `Import mislukt: ${err instanceof Error ? err.message : "onbekend"}`
      );
    }
  };

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

  // Preview summary counts
  const previewCounts = importPreview
    ? {
        valid: importPreview.tickers.filter((t) => t.status === "valid").length,
        unknown: importPreview.tickers.filter((t) => t.status === "unknown").length,
        invalid: importPreview.tickers.filter((t) => t.status === "invalid").length,
        duplicate: importPreview.tickers.filter((t) => t.status === "duplicate").length,
      }
    : null;
  const importableCount = previewCounts ? previewCounts.valid + previewCounts.unknown : 0;

  return (
    <AppLayout
      title="Watchlist"
      subtitle="Volg bedrijven en stel automatische alerts in"
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setImportPreview(null);
              setUploadDialogOpen(true);
            }}
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
                    onClick={() => {
                      setImportPreview(null);
                      setUploadDialogOpen(true);
                    }}
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

      {/* Excel upload dialog with preview */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) setImportPreview(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel/CSV importeren</DialogTitle>
            <DialogDescription>
              Upload een .xlsx of .csv bestand met tickers. Headers worden
              automatisch gedetecteerd. Je krijgt een preview vóór import.
            </DialogDescription>
          </DialogHeader>

          {/* File input */}
          <div className="py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={parsing}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Parsing indicator */}
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Bestand wordt geanalyseerd...
            </div>
          )}

          {/* Preview results */}
          {importPreview && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {importPreview.totalRows} rij(en)
                </Badge>
                {previewCounts!.valid > 0 && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    ✓ {previewCounts!.valid} geldig
                  </Badge>
                )}
                {previewCounts!.unknown > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                    + {previewCounts!.unknown} nieuw
                  </Badge>
                )}
                {previewCounts!.invalid > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    ✗ {previewCounts!.invalid} ongeldig
                  </Badge>
                )}
                {previewCounts!.duplicate > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {previewCounts!.duplicate} dubbel
                  </Badge>
                )}
              </div>

              {/* Errors */}
              {importPreview.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                  {importPreview.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              )}

              {/* Ticker table */}
              {importPreview.tickers.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Ticker</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead>Opmerking</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.tickers.map((t, i) => {
                        const cfg = STATUS_CONFIG[t.status];
                        const Icon = cfg.icon;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm font-medium">
                              {t.cleaned}
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 text-xs ${cfg.className}`}>
                                <Icon className="h-3.5 w-3.5" />
                                {cfg.label}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {t.remark}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {importPreview && importableCount > 0 && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreview(null);
                }}
              >
                Annuleren
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={bulkImport.isPending}
              >
                {bulkImport.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Importeren...
                  </>
                ) : (
                  `${importableCount} ticker(s) importeren`
                )}
              </Button>
            </DialogFooter>
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
              Stel een alert in om een melding te ontvangen wanneer een bepaalde waarde wordt bereikt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                  {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
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
                onValueChange={(v) => setAlertCondition(v as AlertCondition)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Drempelwaarde</Label>
              <Input
                type="number"
                step="any"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="Bijv. 25.50"
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

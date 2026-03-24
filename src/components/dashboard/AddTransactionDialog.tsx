import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AssetClass = Database["public"]["Enums"]["asset_class"];
type CurrencyCode = Database["public"]["Enums"]["currency_code"];
type TransactionType = Database["public"]["Enums"]["transaction_type"];

const ASSET_CLASSES: AssetClass[] = ["CEF", "BDC", "REIT", "ETF", "PREFERRED", "BABY_BOND", "OTHER"];
const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "CAD", "GBP", "CHF", "AUD"];

interface AddTransactionDialogProps {
  children?: React.ReactNode;
}

export function AddTransactionDialog({ children }: AddTransactionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [ticker, setTicker] = useState("");
  const [securityName, setSecurityName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("CEF");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [txType, setTxType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split("T")[0]);
  const [portfolioId, setPortfolioId] = useState("");
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [creatingNewPortfolio, setCreatingNewPortfolio] = useState(false);

  // Fetch portfolios
  const { data: portfolios } = useQuery({
    queryKey: ["portfolios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch existing securities for autocomplete
  const { data: existingSecurities } = useQuery({
    queryKey: ["securities-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("securities")
        .select("id, ticker, name, asset_class, currency")
        .eq("is_active", true)
        .order("ticker");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Match existing security by ticker
  const matchedSecurity = useMemo(() => {
    if (!ticker || !existingSecurities) return null;
    return existingSecurities.find(
      (s) => s.ticker.toUpperCase() === ticker.toUpperCase()
    );
  }, [ticker, existingSecurities]);

  // Auto-set first portfolio
  const effectivePortfolioId = portfolioId || portfolios?.[0]?.id || "";

  const resetForm = () => {
    setTicker("");
    setSecurityName("");
    setAssetClass("CEF");
    setCurrency("USD");
    setTxType("BUY");
    setQuantity("");
    setPrice("");
    setTradeDate(new Date().toISOString().split("T")[0]);
    setPortfolioId("");
    setNewPortfolioName("");
    setCreatingNewPortfolio(false);
  };

  const handlePortfolioChange = (value: string) => {
    if (value === "__new__") {
      setCreatingNewPortfolio(true);
      setPortfolioId("");
    } else {
      setCreatingNewPortfolio(false);
      setPortfolioId(value);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Je moet ingelogd zijn om transacties op te slaan");
      return;
    }

    let activePortfolioId = effectivePortfolioId;

    // Create new portfolio if user chose that option
    if (creatingNewPortfolio) {
      const name = newPortfolioName.trim();
      if (!name) {
        toast.error("Vul een naam in voor het nieuwe portfolio");
        return;
      }
      try {
        const { data: newPortfolio, error: portfolioErr } = await supabase
          .from("portfolios")
          .insert({
            user_id: user.id,
            name,
            base_currency: "EUR",
            strategy: "BUY_AND_HOLD",
          })
          .select("id")
          .single();
        if (portfolioErr) throw portfolioErr;
        activePortfolioId = newPortfolio.id;
        queryClient.invalidateQueries({ queryKey: ["portfolios"] });
        toast.success(`Portfolio "${name}" aangemaakt`);
      } catch (err: any) {
        console.error("Create portfolio error:", err);
        toast.error("Kon geen portfolio aanmaken. Probeer het opnieuw.");
        return;
      }
    } else if (!activePortfolioId) {
      // Fallback: auto-create default if somehow no portfolio exists and not creating new
      try {
        const { data: newPortfolio, error: portfolioErr } = await supabase
          .from("portfolios")
          .insert({
            user_id: user.id,
            name: "Mijn Portfolio",
            base_currency: "EUR",
            strategy: "BUY_AND_HOLD",
          })
          .select("id")
          .single();
        if (portfolioErr) throw portfolioErr;
        activePortfolioId = newPortfolio.id;
        queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      } catch (err: any) {
        console.error("Auto-create portfolio error:", err);
        toast.error("Kon geen portfolio aanmaken. Probeer het opnieuw.");
        return;
      }
    }

    const qty = parseFloat(quantity);
    const prc = parseFloat(price);
    if (!ticker.trim() || isNaN(qty) || qty <= 0 || isNaN(prc) || prc <= 0) {
      toast.error("Vul alle velden correct in");
      return;
    }

    setSaving(true);
    try {
      // 1. Find or create security
      let securityId: string;
      if (matchedSecurity) {
        securityId = matchedSecurity.id;
      } else {
        const { data: newSec, error: secErr } = await supabase
          .from("securities")
          .insert({
            ticker: ticker.toUpperCase().trim(),
            name: securityName.trim() || null,
            asset_class: assetClass,
            currency,
          })
          .select("id")
          .single();
        if (secErr) throw secErr;
        securityId = newSec.id;
      }

      const grossAmount = qty * prc;

      // 2. Insert transaction
      const { error: txErr } = await supabase.from("transactions").insert({
        portfolio_id: activePortfolioId,
        security_id: securityId,
        transaction_type: txType as TransactionType,
        trade_date: tradeDate,
        quantity: qty,
        price: prc,
        currency: matchedSecurity?.currency ?? currency,
        gross_amount: grossAmount,
        net_amount: grossAmount,
        sync_source: "MANUAL" as const,
      });
      if (txErr) throw txErr;

      // 3. Upsert position
      const { data: existingPos } = await supabase
        .from("positions")
        .select("id, quantity, total_cost_basis, avg_cost_basis")
        .eq("portfolio_id", activePortfolioId)
        .eq("security_id", securityId)
        .maybeSingle();

      if (existingPos) {
        const newQty = txType === "BUY"
          ? existingPos.quantity + qty
          : Math.max(0, existingPos.quantity - qty);
        const newCost = txType === "BUY"
          ? existingPos.total_cost_basis + grossAmount
          : existingPos.total_cost_basis * (newQty / existingPos.quantity || 0);
        const newAvg = newQty > 0 ? newCost / newQty : 0;

        await supabase
          .from("positions")
          .update({
            quantity: newQty,
            total_cost_basis: newCost,
            avg_cost_basis: newAvg,
            last_updated: new Date().toISOString(),
          })
          .eq("id", existingPos.id);
      } else if (txType === "BUY") {
        await supabase.from("positions").insert({
          portfolio_id: activePortfolioId,
          security_id: securityId,
          quantity: qty,
          avg_cost_basis: prc,
          total_cost_basis: grossAmount,
          currency: matchedSecurity?.currency ?? currency,
        });
      }

      // 4. Insert initial market_data price if new security
      if (!matchedSecurity) {
        await supabase.from("market_data").insert({
          security_id: securityId,
          data_date: tradeDate,
          close_price: prc,
          market_price: prc,
        });
      }

      toast.success(`${txType === "BUY" ? "Aankoop" : "Verkoop"} van ${ticker.toUpperCase()} opgeslagen`);
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["securities-list"] });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      console.error("Transaction save error:", err);
      toast.error(err.message || "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Transactie toevoegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transactie toevoegen</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Portfolio */}
          {(portfolios?.length ?? 0) > 0 && (
            <div className="grid gap-1.5">
              <Label>Portfolio</Label>
              <Select
                value={effectivePortfolioId}
                onValueChange={setPortfolioId}
              >
                <SelectTrigger><SelectValue placeholder="Kies portfolio" /></SelectTrigger>
                <SelectContent>
                  {portfolios?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type */}
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={txType} onValueChange={(v) => setTxType(v as "BUY" | "SELL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">Koop (BUY)</SelectItem>
                <SelectItem value="SELL">Verkoop (SELL)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ticker */}
          <div className="grid gap-1.5">
            <Label>Ticker</Label>
            <Input
              placeholder="bijv. MAIN, O, ARCC"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
            {matchedSecurity && (
              <p className="text-xs text-muted-foreground">
                ✓ Gevonden: {matchedSecurity.name ?? matchedSecurity.ticker} ({matchedSecurity.asset_class})
              </p>
            )}
          </div>

          {/* New security fields */}
          {!matchedSecurity && ticker.length >= 1 && (
            <>
              <div className="grid gap-1.5">
                <Label>Naam (optioneel)</Label>
                <Input
                  placeholder="bijv. Main Street Capital"
                  value={securityName}
                  onChange={(e) => setSecurityName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Asset class</Label>
                  <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_CLASSES.map((ac) => (
                        <SelectItem key={ac} value={ac}>{ac}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Valuta</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Aantal</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Prijs per stuk</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="12.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Date */}
          <div className="grid gap-1.5">
            <Label>Datum</Label>
            <Input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
            />
          </div>

          {/* Summary */}
          {quantity && price && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Totaal:</span>{" "}
              {new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: matchedSecurity?.currency ?? currency,
              }).format(parseFloat(quantity) * parseFloat(price))}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

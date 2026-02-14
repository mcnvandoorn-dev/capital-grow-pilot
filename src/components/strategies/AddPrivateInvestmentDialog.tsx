import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAddPrivateInvestment } from "@/hooks/usePrivateInvestments";
import { toast } from "sonner";

const ASSET_TYPES = [
  { value: "private_equity", label: "Private Equity" },
  { value: "private_debt", label: "Private Debt" },
  { value: "real_estate", label: "Real Estate" },
  { value: "venture_capital", label: "Venture Capital" },
  { value: "family_loan", label: "Family Loan" },
  { value: "other", label: "Other" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Maandelijks" },
  { value: "quarterly", label: "Kwartaal" },
  { value: "annually", label: "Jaarlijks" },
];

const SECTOR_SUGGESTIONS = [
  "Technology", "Real Estate", "Private Credit", "Healthcare",
  "Infrastructure", "Energy", "Consumer", "Financial Services", "Overig",
];

export function AddPrivateInvestmentDialog() {
  const [open, setOpen] = useState(false);
  const addMutation = useAddPrivateInvestment();

  const [form, setForm] = useState({
    name: "",
    asset_type: "private_equity",
    invested_amount: "",
    current_value: "",
    annual_cashflow: "",
    cashflow_frequency: "annually",
    expected_growth_pct: "",
    start_date: new Date().toISOString().split("T")[0],
    exit_horizon: "",
    currency: "EUR",
    sector_label: "",
    geography_label: "",
    risk_bucket: "",
    notes: "",
    has_loan: false,
    loan_amount: "",
    loan_interest_rate: "",
    loan_monthly_payment: "",
  });

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.invested_amount) {
      toast.error("Naam en geïnvesteerd bedrag zijn verplicht");
      return;
    }

    try {
      await addMutation.mutateAsync({
        name: form.name.trim(),
        asset_type: form.asset_type,
        invested_amount: parseFloat(form.invested_amount),
        current_value: form.current_value ? parseFloat(form.current_value) : null,
        annual_cashflow: form.annual_cashflow ? parseFloat(form.annual_cashflow) : 0,
        cashflow_frequency: form.cashflow_frequency,
        expected_growth_pct: form.expected_growth_pct ? parseFloat(form.expected_growth_pct) : null,
        start_date: form.start_date,
        exit_horizon: form.exit_horizon || null,
        currency: form.currency,
        sector_label: form.sector_label || null,
        geography_label: form.geography_label || null,
        risk_bucket: form.risk_bucket || null,
        notes: form.notes || null,
        has_loan: form.has_loan,
        loan_amount: form.has_loan && form.loan_amount ? parseFloat(form.loan_amount) : null,
        loan_interest_rate: form.has_loan && form.loan_interest_rate ? parseFloat(form.loan_interest_rate) : null,
        loan_monthly_payment: form.has_loan && form.loan_monthly_payment ? parseFloat(form.loan_monthly_payment) : null,
      });
      toast.success("Private investering toegevoegd");
      setOpen(false);
      setForm({
        name: "", asset_type: "private_equity", invested_amount: "", current_value: "",
        annual_cashflow: "", cashflow_frequency: "annually", expected_growth_pct: "",
        start_date: new Date().toISOString().split("T")[0], exit_horizon: "", currency: "EUR",
        sector_label: "", geography_label: "", risk_bucket: "", notes: "",
        has_loan: false, loan_amount: "", loan_interest_rate: "", loan_monthly_payment: "",
      });
    } catch (err: any) {
      toast.error(err.message ?? "Fout bij opslaan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Private Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Private Investering Toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Asset naam *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Bijv. Huurpand Amsterdam" />
          </div>

          {/* Type + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asset type *</Label>
              <Select value={form.asset_type} onValueChange={(v) => update("asset_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valuta</Label>
              <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Geïnvesteerd bedrag *</Label>
              <Input type="number" step="0.01" min="0" value={form.invested_amount} onChange={(e) => update("invested_amount", e.target.value)} placeholder="100000" />
            </div>
            <div className="space-y-1.5">
              <Label>Huidige waarde</Label>
              <Input type="number" step="0.01" min="0" value={form.current_value} onChange={(e) => update("current_value", e.target.value)} placeholder="Optioneel" />
            </div>
          </div>

          {/* Cashflow */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Jaarlijkse cashflow</Label>
              <Input type="number" step="0.01" min="0" value={form.annual_cashflow} onChange={(e) => update("annual_cashflow", e.target.value)} placeholder="8000" />
            </div>
            <div className="space-y-1.5">
              <Label>Frequentie</Label>
              <Select value={form.cashflow_frequency} onValueChange={(v) => update("cashflow_frequency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Verwachte groei %</Label>
              <Input type="number" step="0.1" value={form.expected_growth_pct} onChange={(e) => update("expected_growth_pct", e.target.value)} placeholder="3" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Startdatum *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Exit horizon</Label>
              <Input type="date" value={form.exit_horizon} onChange={(e) => update("exit_horizon", e.target.value)} />
            </div>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Sector</Label>
              <Select value={form.sector_label} onValueChange={(v) => update("sector_label", v)}>
                <SelectTrigger><SelectValue placeholder="Selecteer" /></SelectTrigger>
                <SelectContent>
                  {SECTOR_SUGGESTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Geografie</Label>
              <Input value={form.geography_label} onChange={(e) => update("geography_label", e.target.value)} placeholder="NL, EU, US..." />
            </div>
            <div className="space-y-1.5">
              <Label>Risico</Label>
              <Select value={form.risk_bucket} onValueChange={(v) => update("risk_bucket", v)}>
                <SelectTrigger><SelectValue placeholder="Selecteer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Midden</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loan */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Lening afgesloten?</Label>
              <Switch checked={form.has_loan} onCheckedChange={(v) => setForm(prev => ({ ...prev, has_loan: v }))} />
            </div>
            {form.has_loan && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Leningbedrag</Label>
                  <Input type="number" step="0.01" min="0" value={form.loan_amount} onChange={(e) => update("loan_amount", e.target.value)} placeholder="150000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rente %</Label>
                  <Input type="number" step="0.01" min="0" value={form.loan_interest_rate} onChange={(e) => update("loan_interest_rate", e.target.value)} placeholder="3.5" />
                </div>
                <div className="space-y-1.5">
                  <Label>Maandlast</Label>
                  <Input type="number" step="0.01" min="0" value={form.loan_monthly_payment} onChange={(e) => update("loan_monthly_payment", e.target.value)} placeholder="750" />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notities</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optionele opmerkingen..." rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={addMutation.isPending}>
            {addMutation.isPending ? "Opslaan..." : "Toevoegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

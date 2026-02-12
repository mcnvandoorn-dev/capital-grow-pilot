import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAlerts,
  useSecuritiesForSelect,
  useCreateAlert,
  useToggleAlert,
  useDeleteAlert,
} from "@/hooks/useAlerts";
import type { Database } from "@/integrations/supabase/types";

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

const Alerts = () => {
  const { data: alerts, isLoading } = useAlerts();
  const { data: securities } = useSecuritiesForSelect();
  const createAlert = useCreateAlert();
  const toggleAlert = useToggleAlert();
  const deleteAlert = useDeleteAlert();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [securityId, setSecurityId] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("PRICE");
  const [condition, setCondition] = useState<AlertCondition>("BELOW");
  const [threshold, setThreshold] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setSecurityId("");
    setAlertType("PRICE");
    setCondition("BELOW");
    setThreshold("");
    setNotes("");
  };

  const handleCreate = async () => {
    if (!securityId || !threshold) {
      toast.error("Selecteer een security en vul een drempelwaarde in.");
      return;
    }

    const val = parseFloat(threshold);
    if (isNaN(val)) {
      toast.error("Drempelwaarde moet een getal zijn.");
      return;
    }

    try {
      await createAlert.mutateAsync({
        security_id: securityId,
        alert_type: alertType,
        condition,
        threshold: val,
        notes: notes || null,
      });
      toast.success("Alert aangemaakt");
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error("Kon alert niet aanmaken.");
    }
  };

  const handleToggle = (id: string, currentActive: boolean) => {
    toggleAlert.mutate({ id, is_active: !currentActive });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlert.mutateAsync(id);
      toast.success("Alert verwijderd");
    } catch {
      toast.error("Kon alert niet verwijderen.");
    }
  };

  return (
    <AppLayout
      title="Meldingen"
      subtitle="Stel prijsalarmen in en ontvang signalen"
      actions={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nieuw alert
        </Button>
      }
    >
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Actieve alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : alerts && alerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ticker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Conditie</TableHead>
                  <TableHead className="text-right">Drempel</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actief</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {alert.securities?.ticker ?? "—"}
                    </TableCell>
                    <TableCell>{ALERT_TYPE_LABELS[alert.alert_type]}</TableCell>
                    <TableCell>{CONDITION_LABELS[alert.condition]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {alert.threshold}
                    </TableCell>
                    <TableCell className="text-center">
                      {alert.is_triggered ? (
                        <Badge variant="destructive" className="text-xs">
                          Getriggerd
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Wachtend
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={() =>
                          handleToggle(alert.id, alert.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDelete(alert.id)}
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
              icon={Bell}
              title="Geen alerts"
              description="Stel een prijsalarm in om meldingen te ontvangen wanneer een security een bepaalde drempel bereikt."
              action={
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Eerste alert instellen
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Create alert dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw alert</DialogTitle>
            <DialogDescription>
              Kies een security, type en drempelwaarde voor je melding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Security</Label>
              <Select value={securityId} onValueChange={setSecurityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een security..." />
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
                    {(Object.entries(ALERT_TYPE_LABELS) as [AlertType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conditie</Label>
                <Select
                  value={condition}
                  onValueChange={(v) => setCondition(v as AlertCondition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(CONDITION_LABELS) as [AlertCondition, string][]
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
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notities (optioneel)</Label>
              <Input
                placeholder="Bijv. kopen bij deze prijs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleCreate}
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

export default Alerts;

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Settings, Link, RefreshCw, Plus, Trash2, FolderOpen, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type IbkrConnectionSafe = {
  id: string;
  user_id: string;
  connection_name: string;
  client_portal_enabled: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  strategy: string;
  created_at: string;
  updated_at: string;
};

const STRATEGY_LABELS: Record<string, string> = {
  BUY_AND_HOLD: "Buy & Hold",
  DIVIDEND_GROWTH: "Dividend Growth",
  WORKING_CAPITAL_GROWTH: "Working Capital Growth",
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [historyQueryId, setHistoryQueryId] = useState("");

  // Form state
  const [connectionName, setConnectionName] = useState("");
  const [flexToken, setFlexToken] = useState("");
  const [flexQueryId, setFlexQueryId] = useState("");
  const [strategy, setStrategy] = useState<string>("BUY_AND_HOLD");

  const { data: connections, isLoading } = useQuery({
    queryKey: ["ibkr-connections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ibkr_connections_safe" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as IbkrConnectionSafe[];
    },
    enabled: !!user,
  });

  const { data: portfolios, isLoading: loadingPortfolios } = useQuery({
    queryKey: ["portfolios-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, name, strategy, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createConnection = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ibkr_connections").insert({
        user_id: user!.id,
        connection_name: connectionName,
        flex_token: flexToken,
        flex_query_id: flexQueryId,
        strategy: strategy as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Verbinding aangemaakt" });
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
      setOpen(false);
      setConnectionName("");
      setFlexToken("");
      setFlexQueryId("");
      setStrategy("BUY_AND_HOLD");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Fout", description: error.message });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params: { connectionId: string; refCode?: string; queryIdOverride?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const MAX_CLIENT_RETRIES = 5;

      const callSync = async (refCode?: string, attempt = 0): Promise<any> => {
        if (attempt >= MAX_CLIENT_RETRIES) {
          throw new Error("IBKR rapport kon niet worden opgehaald na meerdere pogingen. Probeer het later opnieuw — IBKR heeft soms meer tijd nodig om rapporten te genereren.");
        }

        const body: any = { connectionId: params.connectionId, refCode };
        if (params.queryIdOverride) body.queryIdOverride = params.queryIdOverride;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ibkr-sync`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session!.access_token}`,
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify(body),
          }
        );
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Sync failed");

        if (json.status === "pending" && json.refCode) {
          toast({
            title: params.queryIdOverride
              ? "Historisch rapport wordt gegenereerd..."
              : `IBKR rapport wordt gegenereerd... (poging ${attempt + 1}/${MAX_CLIENT_RETRIES})`,
            description: "Even geduld, we proberen het opnieuw.",
          });
          await new Promise((r) => setTimeout(r, 15000));
          return callSync(json.refCode, attempt + 1);
        }

        return json;
      };

      return callSync(params.refCode);
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronisatie voltooid",
        description: `${data.records_created} nieuw, ${data.records_updated} bijgewerkt van ${data.records_processed} verwerkt.`,
      });
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setHistoryOpen(null);
      setHistoryQueryId("");
    },
    onError: async (error: any, variables) => {
      toast({ variant: "destructive", title: "Synchronisatie mislukt", description: error.message });
      // Reset sync status so the button is usable again
      await supabase
        .from("ibkr_connections")
        .update({ sync_status: "idle" })
        .eq("id", variables.connectionId);
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ibkr_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Verbinding verwijderd" });
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
    },
  });

  const deletePortfolio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Portfolio verwijderd" });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios-settings"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Fout bij verwijderen", description: error.message });
    },
  });

  const statusLabel = (status: string | null) => {
    switch (status) {
      case "syncing":
        return <Badge className="bg-info/10 text-info border-0">Synchroniseren...</Badge>;
      case "error":
        return <Badge variant="destructive">Fout</Badge>;
      default:
        return <Badge variant="secondary">Inactief</Badge>;
    }
  };

  return (
    <AppLayout title="Instellingen" subtitle="Beheer je koppelingen en portfolio's">
      {/* IBKR Connections */}
      <Card className="shadow-sm max-w-2xl mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-medium">
              Interactive Brokers koppelingen
            </CardTitle>
            <CardDescription>
              Koppel je IBKR account via Flex Query en wijs een strategie toe.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuwe IBKR koppeling</DialogTitle>
                <DialogDescription>
                  Maak een Flex Query aan in IBKR Account Management en vul de gegevens hieronder in.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createConnection.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="connName">Naam</Label>
                  <Input
                    id="connName"
                    placeholder="Bijv. Hoofdaccount"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flexToken">Flex Token</Label>
                  <Input
                    id="flexToken"
                    type="password"
                    placeholder="Je IBKR Flex Web Service token"
                    value={flexToken}
                    onChange={(e) => setFlexToken(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="queryId">Flex Query ID</Label>
                  <Input
                    id="queryId"
                    placeholder="Bijv. 123456"
                    value={flexQueryId}
                    onChange={(e) => setFlexQueryId(e.target.value)}
                    required
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strategy">Strategie</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een strategie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY_AND_HOLD">Buy & Hold</SelectItem>
                      <SelectItem value="DIVIDEND_GROWTH">Dividend Growth</SelectItem>
                      <SelectItem value="WORKING_CAPITAL_GROWTH">Working Capital Growth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createConnection.isPending}>
                  {createConnection.isPending ? "Aanmaken..." : "Koppeling aanmaken"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laden...</p>
          ) : !connections || connections.length === 0 ? (
            <EmptyState
              icon={Link}
              title="Geen koppelingen"
              description="Voeg je eerste IBKR koppeling toe om transacties automatisch te importeren."
            />
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{conn.connection_name}</p>
                      {statusLabel(conn.sync_status)}
                      <Badge variant="outline" className="text-xs">
                        {STRATEGY_LABELS[(conn as any).strategy] ?? "Buy & Hold"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {conn.last_sync_at && (
                        <>
                          Laatst gesynchroniseerd:{" "}
                          {new Date(conn.last_sync_at).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate({ connectionId: conn.id })}
                      disabled={syncMutation.isPending || conn.sync_status === "syncing"}
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryOpen(conn.id)}
                      disabled={syncMutation.isPending || conn.sync_status === "syncing"}
                    >
                      <History className="mr-1.5 h-3.5 w-3.5" />
                      Historisch
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteConnection.mutate(conn.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical import dialog */}
      <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) { setHistoryOpen(null); setHistoryQueryId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historische import</DialogTitle>
            <DialogDescription>
              Voer het Flex Query ID in van een Activity Statement dat een heel jaar beslaat.
              Maak in IBKR Account Management een nieuwe Flex Query aan met periode "Last 365 Calendar Days" of een specifiek jaar,
              inclusief Trades, Dividends en Cash Transactions.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (historyOpen && historyQueryId) {
                syncMutation.mutate({ connectionId: historyOpen, queryIdOverride: historyQueryId });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="histQueryId">Activity Statement Flex Query ID</Label>
              <Input
                id="histQueryId"
                placeholder="Bijv. 789012"
                value={historyQueryId}
                onChange={(e) => setHistoryQueryId(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <Button type="submit" className="w-full" disabled={syncMutation.isPending}>
              {syncMutation.isPending ? "Importeren..." : "Historische data importeren"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Portfolio management */}
      <Card className="shadow-sm max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Portfolio's</CardTitle>
          <CardDescription>
            Beheer je portfolio's. Let op: verwijderen verwijdert ook alle posities, transacties en dividenden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPortfolios ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laden...</p>
          ) : !portfolios || portfolios.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Geen portfolio's"
              description="Portfolio's worden automatisch aangemaakt bij het synchroniseren van een IBKR koppeling."
            />
          ) : (
            <div className="space-y-3">
              {portfolios.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{p.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {STRATEGY_LABELS[p.strategy] ?? p.strategy}
                      </Badge>
                      {!p.is_active && <Badge variant="secondary">Inactief</Badge>}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Portfolio verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Weet je zeker dat je "{p.name}" wilt verwijderen? Dit verwijdert ook alle
                          bijbehorende posities, transacties, dividenden en capital events. Dit kan
                          niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePortfolio.mutate(p.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Verwijderen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default SettingsPage;

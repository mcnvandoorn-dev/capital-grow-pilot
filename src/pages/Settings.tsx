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
import { Settings, Link, RefreshCw, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form state
  const [connectionName, setConnectionName] = useState("");
  const [flexToken, setFlexToken] = useState("");
  const [flexQueryId, setFlexQueryId] = useState("");

  const { data: connections, isLoading } = useQuery({
    queryKey: ["ibkr-connections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ibkr_connections")
        .select("*")
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
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: error.message,
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params: { connectionId: string; refCode?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const callSync = async (refCode?: string): Promise<any> => {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ibkr-sync`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session!.access_token}`,
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ connectionId: params.connectionId, refCode }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Sync failed");
        
        if (json.status === "pending" && json.refCode) {
          // Report not ready yet, wait and retry with same refCode
          toast({
            title: "IBKR rapport wordt gegenereerd...",
            description: "Even geduld, we proberen het opnieuw.",
          });
          await new Promise((r) => setTimeout(r, 15000));
          return callSync(json.refCode);
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
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Synchronisatie mislukt",
        description: error.message,
      });
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ibkr_connections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Verbinding verwijderd" });
      queryClient.invalidateQueries({ queryKey: ["ibkr-connections"] });
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
    <AppLayout title="Instellingen" subtitle="Beheer je IBKR koppelingen">
      <Card className="shadow-sm max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-medium">
              Interactive Brokers koppelingen
            </CardTitle>
            <CardDescription>
              Koppel je IBKR account via Flex Query om automatisch transacties en
              dividenden te importeren.
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
                  Maak een Flex Query aan in IBKR Account Management en vul de
                  gegevens hieronder in.
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createConnection.isPending}
                >
                  {createConnection.isPending
                    ? "Aanmaken..."
                    : "Koppeling aanmaken"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Laden...
            </p>
          ) : !connections || connections.length === 0 ? (
            <EmptyState
              icon={Link}
              title="Geen koppelingen"
              description="Voeg je eerste IBKR koppeling toe om transacties automatisch te importeren."
            />
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{conn.connection_name}</p>
                      {statusLabel(conn.sync_status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Query ID: {conn.flex_query_id || "—"}
                      {conn.last_sync_at && (
                        <>
                          {" · "}Laatst gesynchroniseerd:{" "}
                          {new Date(conn.last_sync_at).toLocaleDateString(
                            "nl-NL",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate({ connectionId: conn.id })}
                      disabled={
                        syncMutation.isPending || conn.sync_status === "syncing"
                      }
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3.5 w-3.5 ${
                          syncMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                      Synchroniseren
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteConnection.mutate(conn.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
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

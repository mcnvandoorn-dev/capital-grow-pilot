import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Upload,
  Trash2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDeepDive, type DeepDiveItem } from "@/hooks/useDeepDive";

interface DeepDiveTabProps {
  securityId: string;
  ticker: string;
  autoSearching?: boolean;
}

export function DeepDiveTab({ securityId, ticker, autoSearching }: DeepDiveTabProps) {
  const { items, isLoading, isSearching, isUploading, searchWeb, uploadPdf, deleteItem } =
    useDeepDive(securityId);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = () => {
    const q = searchQuery.trim() || undefined;
    searchWeb(ticker, q);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPdf(file);
      e.target.value = "";
    }
  };

  const statusBadge = (status: DeepDiveItem["status"]) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Wachtend", variant: "outline" },
      processing: { label: "Verwerken...", variant: "secondary" },
      done: { label: "Klaar", variant: "default" },
      error: { label: "Fout", variant: "destructive" },
    };
    const m = map[status] || map.pending;
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Search & Upload controls */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Bronnen zoeken & uploaden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={`Zoek naar "${ticker}" analyses, SEC filings...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              Zoeken
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              PDF uploaden
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload analyst reports, jaarverslagen of research PDFs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nog geen deep dive bronnen. Zoek op het web of upload een PDF om te beginnen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {item.source_type === "scrape" ? (
                      <Globe className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">{item.title}</h4>
                        {statusBadge(item.status)}
                      </div>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {new URL(item.url).hostname}
                        </a>
                      )}

                      {item.summary && (
                        <div className="mt-2">
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {expandedId === item.id ? (
                              <>
                                <ChevronUp className="h-3 w-3" /> Samenvatting verbergen
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" /> Samenvatting tonen
                              </>
                            )}
                          </button>
                          {expandedId === item.id && (
                            <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
                              {item.summary}
                            </div>
                          )}
                        </div>
                      )}

                      {item.error_message && (
                        <p className="text-xs text-destructive mt-1">{item.error_message}</p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(item.created_at).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => deleteItem.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

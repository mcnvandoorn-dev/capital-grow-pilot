import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DeepDiveItem {
  id: string;
  security_id: string;
  user_id: string;
  source_type: "scrape" | "upload";
  title: string;
  url: string | null;
  content_markdown: string | null;
  summary: string | null;
  file_path: string | null;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useDeepDive(securityId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["deep-dive", securityId],
    queryFn: async () => {
      if (!securityId) return [];
      const { data, error } = await supabase
        .from("deep_dive_items")
        .select("*")
        .eq("security_id", securityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeepDiveItem[];
    },
    enabled: !!securityId,
  });

  const searchWeb = async (ticker: string, query?: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deep-dive-scrape", {
        body: { security_id: securityId, ticker, query },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Zoekresultaten opgehaald", description: `${data.items?.length || 0} bronnen gevonden en geanalyseerd.` });
      queryClient.invalidateQueries({ queryKey: ["deep-dive", securityId] });
      return data.items;
    } catch (e: any) {
      toast({ title: "Fout bij zoeken", description: e.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const uploadPdf = async (file: File) => {
    if (!securityId) return;
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");

      const filePath = `${user.id}/${securityId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("deep-dive-docs")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      // Create DB record
      const { data: item, error: insertError } = await supabase
        .from("deep_dive_items")
        .insert({
          security_id: securityId,
          user_id: user.id,
          source_type: "upload",
          title: file.name,
          file_path: filePath,
          status: "pending",
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Trigger analysis
      const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke("deep-dive-analyze", {
        body: { item_id: item.id },
      });

      if (analyzeError || analyzeData?.error) {
        console.error("Analysis error:", analyzeError || analyzeData?.error);
      }

      toast({ title: "PDF geüpload", description: "Bestand wordt geanalyseerd..." });
      queryClient.invalidateQueries({ queryKey: ["deep-dive", securityId] });
    } catch (e: any) {
      toast({ title: "Upload mislukt", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (item?.file_path) {
        await supabase.storage.from("deep-dive-docs").remove([item.file_path]);
      }
      const { error } = await supabase.from("deep_dive_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deep-dive", securityId] });
      toast({ title: "Item verwijderd" });
    },
    onError: (e: any) => {
      toast({ title: "Verwijderen mislukt", description: e.message, variant: "destructive" });
    },
  });

  return { items, isLoading, isSearching, isUploading, searchWeb, uploadPdf, deleteItem };
}

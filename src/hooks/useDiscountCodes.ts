import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DiscountCode {
  id: string;
  code: string;
  kind: "percent" | "fixed" | string;
  value: number;
  applies_to: "all" | "services" | "products" | string;
  min_subtotal: number;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  expires_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export function useDiscountCodes() {
  return useQuery({
    queryKey: ["discount_codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DiscountCode[];
    },
  });
}

export function useUpsertDiscountCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (d: Partial<DiscountCode> & { id?: string }) => {
      const payload: any = {
        code: (d.code || "").toUpperCase().trim(),
        kind: d.kind || "percent",
        value: d.value ?? 0,
        applies_to: d.applies_to || "all",
        min_subtotal: d.min_subtotal ?? 0,
        max_uses: d.max_uses ?? null,
        active: d.active ?? true,
        expires_at: d.expires_at || null,
        notes: d.notes || "",
      };
      if (d.id) {
        const { error } = await supabase.from("discount_codes").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_codes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discount_codes"] }); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteDiscountCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discount_codes"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}

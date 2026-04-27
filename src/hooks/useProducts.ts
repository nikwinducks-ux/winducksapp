import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  unit_price: number;
  taxable: boolean;
  active: boolean;
  image_url: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useProducts(activeOnly = false) {
  return useQuery({
    queryKey: ["products", { activeOnly }],
    queryFn: async () => {
      let q = supabase.from("products").select("*").order("display_order", { ascending: true }).order("name");
      if (activeOnly) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Product[];
    },
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (p: Partial<Product> & { id?: string }) => {
      if (p.id) {
        const { error } = await supabase.from("products").update({
          name: p.name, sku: p.sku, description: p.description,
          unit_price: p.unit_price, taxable: p.taxable, active: p.active,
          image_url: p.image_url, display_order: p.display_order,
        }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({
          name: p.name || "", sku: p.sku || "", description: p.description || "",
          unit_price: p.unit_price ?? 0, taxable: p.taxable ?? true, active: p.active ?? true,
          image_url: p.image_url || "", display_order: p.display_order ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}

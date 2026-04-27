import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface InvoicePackage {
  id: string;
  invoice_id: string;
  name: string;
  description: string;
  display_order: number;
  is_recommended: boolean;
  is_selected: boolean;
  package_discount_kind: "none" | "percent" | "fixed" | string;
  package_discount_value: number;
  package_discount_reason: string;
}

export interface InvoiceLineItem {
  id: string;
  package_id: string;
  item_type: "service" | "product" | string;
  catalog_ref_id: string | null;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  is_optional: boolean;
  is_selected: boolean;
  discount_allowed: boolean;
  image_url: string;
  display_order: number;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string;
  notes: string;
  recorded_by_user_id: string | null;
  created_at: string;
}

export interface InvoiceManualDiscount {
  id: string;
  invoice_id: string;
  package_id: string | null;
  line_item_id: string | null;
  scope: "invoice" | "package" | "line" | string;
  kind: "percent" | "fixed" | string;
  value: number;
  reason: string;
}

export interface InvoiceAppliedCode {
  id: string;
  invoice_id: string;
  discount_code_id: string | null;
  code_snapshot: string;
  kind: "percent" | "fixed" | string;
  value: number;
  applies_to: "all" | "services" | "products" | string;
  amount_applied: number;
  applied_at: string;
}

export function useInvoicePackages(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_packages", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_packages").select("*")
        .eq("invoice_id", invoiceId!).order("display_order");
      if (error) throw error;
      return (data || []) as InvoicePackage[];
    },
  });
}

export function useInvoiceLineItems(packageIds: string[]) {
  return useQuery({
    queryKey: ["invoice_line_items", packageIds.slice().sort().join(",")],
    enabled: packageIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items").select("*")
        .in("package_id", packageIds).order("display_order");
      if (error) throw error;
      return (data || []) as InvoiceLineItem[];
    },
  });
}

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_payments", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_payments").select("*")
        .eq("invoice_id", invoiceId!).order("payment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as InvoicePayment[];
    },
  });
}

export function useInvoiceManualDiscounts(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_discounts", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_discounts").select("*").eq("invoice_id", invoiceId!);
      if (error) throw error;
      return (data || []) as InvoiceManualDiscount[];
    },
  });
}

export function useInvoiceAppliedCodes(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_applied_codes", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_applied_codes").select("*").eq("invoice_id", invoiceId!);
      if (error) throw error;
      return (data || []) as InvoiceAppliedCode[];
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { customer_id?: string | null; job_id?: string | null; assigned_sp_id?: string | null }) => {
      const { data, error } = await supabase.rpc("create_invoice", {
        _customer_id: args.customer_id ?? null,
        _job_id: args.job_id ?? null,
        _assigned_sp_id: args.assigned_sp_id ?? null,
        _parent_invoice_id: null,
      });
      if (error) throw error;
      return data as { id: string; invoice_number: string; package_id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer_invoices"] }); toast({ title: "Invoice created" }); },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("customer_invoices").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["customer_invoice", vars.id] });
      qc.invalidateQueries({ queryKey: ["customer_invoices"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useUpsertInvoicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<InvoicePackage> & { id?: string; invoice_id: string }) => {
      if (p.id) {
        const { error } = await supabase.from("invoice_packages").update({
          name: p.name, description: p.description, display_order: p.display_order,
          is_recommended: p.is_recommended,
          package_discount_kind: p.package_discount_kind,
          package_discount_value: p.package_discount_value,
          package_discount_reason: p.package_discount_reason,
        }).eq("id", p.id);
        if (error) throw error;
        return p.id;
      }
      const { data, error } = await supabase.from("invoice_packages").insert({
        invoice_id: p.invoice_id,
        name: p.name || "Package",
        description: p.description || "",
        display_order: p.display_order ?? 0,
      }).select("id").single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["invoice_packages", vars.invoice_id] }),
  });
}

export function useDeleteInvoicePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from("invoice_packages").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["invoice_packages", vars.invoice_id] }),
  });
}

export function useDuplicateInvoicePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { package_id: string; invoice_id: string }) => {
      const { data, error } = await supabase.rpc("duplicate_invoice_package", { _package_id: args.package_id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice_packages", vars.invoice_id] });
      qc.invalidateQueries({ queryKey: ["invoice_line_items"] });
      toast({ title: "Variation duplicated" });
    },
  });
}

export function useReplaceInvoiceLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { package_id: string; items: Omit<InvoiceLineItem, "id" | "package_id">[] }) => {
      const { error: delErr } = await supabase.from("invoice_line_items").delete().eq("package_id", args.package_id);
      if (delErr) throw delErr;
      if (args.items.length > 0) {
        const { error: insErr } = await supabase.from("invoice_line_items").insert(
          args.items.map((i, idx) => ({
            package_id: args.package_id,
            item_type: i.item_type, catalog_ref_id: i.catalog_ref_id,
            name: i.name, description: i.description,
            quantity: i.quantity, unit_price: i.unit_price,
            taxable: i.taxable, is_optional: i.is_optional,
            is_selected: i.is_selected, discount_allowed: i.discount_allowed,
            image_url: i.image_url, display_order: idx,
          }))
        );
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_line_items"] }),
  });
}

export function useApplyInvoiceCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { invoice_id: string; code: string }) => {
      const { data, error } = await supabase.rpc("apply_invoice_discount_code", {
        _invoice_id: args.invoice_id, _code: args.code,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice_applied_codes", vars.invoice_id] });
      toast({ title: "Code applied" });
    },
    onError: (e: any) => toast({ title: "Could not apply code", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveInvoiceCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from("invoice_applied_codes").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["invoice_applied_codes", vars.invoice_id] }),
  });
}

export function useUpsertInvoiceManualDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<InvoiceManualDiscount> & { invoice_id: string }) => {
      const payload: any = {
        invoice_id: d.invoice_id,
        package_id: d.package_id ?? null,
        line_item_id: d.line_item_id ?? null,
        scope: d.scope || "invoice",
        kind: d.kind || "fixed",
        value: d.value ?? 0,
        reason: d.reason || "",
      };
      if (d.id) {
        const { error } = await supabase.from("invoice_discounts").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_discounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["invoice_discounts", vars.invoice_id] }),
  });
}

export function useRemoveInvoiceManualDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from("invoice_discounts").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["invoice_discounts", vars.invoice_id] }),
  });
}

export function useRecordInvoicePayment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: {
      invoice_id: string; amount: number; method?: string; reference?: string; notes?: string; payment_date?: string;
    }) => {
      const { data, error } = await supabase.rpc("record_invoice_payment", {
        _invoice_id: args.invoice_id,
        _amount: args.amount,
        _method: args.method ?? "",
        _reference: args.reference ?? "",
        _notes: args.notes ?? "",
        _payment_date: args.payment_date ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["customer_invoice", vars.invoice_id] });
      qc.invalidateQueries({ queryKey: ["invoice_payments", vars.invoice_id] });
      qc.invalidateQueries({ queryKey: ["customer_invoices"] });
      toast({ title: "Payment recorded" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("void_invoice", { _invoice_id: args.id, _reason: args.reason ?? "" });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["customer_invoice", vars.id] });
      qc.invalidateQueries({ queryKey: ["customer_invoices"] });
      toast({ title: "Invoice voided" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useArchiveInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("archive_invoice", { _invoice_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer_invoices"] }); toast({ title: "Archived" }); },
  });
}

export function useUnarchiveInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("unarchive_invoice", { _invoice_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer_invoices"] }); toast({ title: "Restored" }); },
  });
}

export function useConvertEstimateToInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { data, error } = await supabase.rpc("convert_estimate_to_invoice", { _estimate_id: estimateId });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r as { success: boolean; invoice_id: string; invoice_number?: string; reused?: boolean };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["customer_invoices"] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      toast({ title: r.reused ? "Draft invoice reused" : "Invoice created" });
    },
    onError: (e: any) => toast({ title: "Convert failed", description: e.message, variant: "destructive" }),
  });
}

export async function markInvoiceViewedByToken(token: string) {
  await supabase.rpc("mark_invoice_viewed_by_token", { _token: token });
}

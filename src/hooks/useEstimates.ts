import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string | null;
  customer_property_id: string | null;
  job_id: string | null;
  assigned_sp_id: string | null;
  created_by_user_id: string | null;
  status: string;
  estimate_date: string;
  expires_at: string | null;
  internal_notes: string;
  customer_notes: string;
  terms: string;
  share_token: string;
  tax_pct: number;
  deposit_kind: "none" | "fixed" | "percent" | string;
  deposit_value: number;
  accepted_package_id: string | null;
  accepted_at: string | null;
  accepted_total: number | null;
  accepted_deposit: number | null;
  viewed_at: string | null;
  declined_at: string | null;
  decline_reason: string;
  converted_job_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimatePackage {
  id: string;
  estimate_id: string;
  name: string;
  description: string;
  display_order: number;
  is_recommended: boolean;
  is_selected: boolean;
  package_discount_kind: "none" | "percent" | "fixed" | string;
  package_discount_value: number;
  package_discount_reason: string;
}

export interface EstimateLineItem {
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

export interface EstimateDiscount {
  id: string;
  estimate_id: string;
  package_id: string | null;
  scope: "estimate" | "package" | string;
  kind: "percent" | "fixed" | string;
  value: number;
  reason: string;
}

export interface AppliedCode {
  id: string;
  estimate_id: string;
  discount_code_id: string | null;
  code_snapshot: string;
  kind: "percent" | "fixed" | string;
  value: number;
  applies_to: "all" | "services" | "products" | string;
  amount_applied: number;
  applied_at: string;
}

export function useEstimates() {
  return useQuery({
    queryKey: ["estimates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Estimate[];
    },
  });
}

export function useEstimate(id: string | undefined) {
  return useQuery({
    queryKey: ["estimate", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Estimate | null;
    },
  });
}

export function useEstimatePackages(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["estimate_packages", estimateId],
    enabled: !!estimateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_packages").select("*")
        .eq("estimate_id", estimateId!).order("display_order");
      if (error) throw error;
      return (data || []) as EstimatePackage[];
    },
  });
}

export function useEstimateLineItems(packageIds: string[]) {
  return useQuery({
    queryKey: ["estimate_line_items", packageIds.sort().join(",")],
    enabled: packageIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_line_items").select("*")
        .in("package_id", packageIds).order("display_order");
      if (error) throw error;
      return (data || []) as EstimateLineItem[];
    },
  });
}

export function useEstimateDiscounts(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["estimate_discounts", estimateId],
    enabled: !!estimateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_discounts").select("*")
        .eq("estimate_id", estimateId!);
      if (error) throw error;
      return (data || []) as EstimateDiscount[];
    },
  });
}

export function useEstimateAppliedCodes(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["estimate_applied_codes", estimateId],
    enabled: !!estimateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_applied_codes").select("*")
        .eq("estimate_id", estimateId!);
      if (error) throw error;
      return (data || []) as AppliedCode[];
    },
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { customer_id?: string | null; job_id?: string | null; assigned_sp_id?: string | null; customer_property_id?: string | null }) => {
      const { data, error } = await supabase.rpc("create_estimate", {
        _customer_id: args.customer_id ?? null,
        _customer_property_id: args.customer_property_id ?? null,
        _job_id: args.job_id ?? null,
        _assigned_sp_id: args.assigned_sp_id ?? null,
      });
      if (error) throw error;
      return data as { id: string; estimate_number: string; package_id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estimates"] }); toast({ title: "Estimate created" }); },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Estimate> }) => {
      const { error } = await supabase.from("estimates").update(args.patch as any).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate", vars.id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useUpsertPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<EstimatePackage> & { id?: string; estimate_id: string }) => {
      if (p.id) {
        const { error } = await supabase.from("estimate_packages").update({
          name: p.name, description: p.description, display_order: p.display_order,
          is_recommended: p.is_recommended,
          package_discount_kind: p.package_discount_kind,
          package_discount_value: p.package_discount_value,
          package_discount_reason: p.package_discount_reason,
        }).eq("id", p.id);
        if (error) throw error;
        return p.id;
      } else {
        const { data, error } = await supabase.from("estimate_packages").insert({
          estimate_id: p.estimate_id,
          name: p.name || "Package",
          description: p.description || "",
          display_order: p.display_order ?? 0,
          is_recommended: p.is_recommended ?? false,
        }).select("id").single();
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["estimate_packages", vars.estimate_id] }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; estimate_id: string }) => {
      const { error } = await supabase.from("estimate_packages").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["estimate_packages", vars.estimate_id] }),
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}

export function useDuplicatePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { package_id: string; estimate_id: string }) => {
      const { data, error } = await supabase.rpc("duplicate_estimate_package", { _package_id: args.package_id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate_packages", vars.estimate_id] });
      qc.invalidateQueries({ queryKey: ["estimate_line_items"] });
      toast({ title: "Package duplicated" });
    },
    onError: (e: any) => toast({ title: "Duplicate failed", description: e.message, variant: "destructive" }),
  });
}

export function useReplaceLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { package_id: string; items: Omit<EstimateLineItem, "id" | "package_id">[] }) => {
      const { error: delErr } = await supabase.from("estimate_line_items").delete().eq("package_id", args.package_id);
      if (delErr) throw delErr;
      if (args.items.length > 0) {
        const { error: insErr } = await supabase.from("estimate_line_items").insert(
          args.items.map((i, idx) => ({
            package_id: args.package_id,
            item_type: i.item_type,
            catalog_ref_id: i.catalog_ref_id,
            name: i.name,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            taxable: i.taxable,
            is_optional: i.is_optional,
            is_selected: i.is_selected,
            discount_allowed: i.discount_allowed,
            image_url: i.image_url,
            display_order: idx,
          }))
        );
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate_line_items"] }),
  });
}

export function useApplyDiscountCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { estimate_id: string; code: string }) => {
      const { data, error } = await supabase.rpc("apply_discount_code", { _estimate_id: args.estimate_id, _code: args.code });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate_applied_codes", vars.estimate_id] });
      toast({ title: "Discount code applied" });
    },
    onError: (e: any) => toast({ title: "Could not apply code", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveAppliedCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; estimate_id: string }) => {
      const { error } = await supabase.from("estimate_applied_codes").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["estimate_applied_codes", vars.estimate_id] }),
  });
}

export function useUpsertManualDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<EstimateDiscount> & { estimate_id: string; id?: string }) => {
      const payload: any = {
        estimate_id: d.estimate_id,
        package_id: d.package_id ?? null,
        scope: d.scope || "estimate",
        kind: d.kind || "fixed",
        value: d.value ?? 0,
        reason: d.reason || "",
      };
      if (d.id) {
        const { error } = await supabase.from("estimate_discounts").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estimate_discounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["estimate_discounts", vars.estimate_id] }),
  });
}

export function useRemoveManualDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; estimate_id: string }) => {
      const { error } = await supabase.from("estimate_discounts").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["estimate_discounts", vars.estimate_id] }),
  });
}

export function useMarkEstimateSent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("mark_estimate_sent", { _estimate_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["estimate", id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      toast({ title: "Marked as sent" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useDuplicateEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("duplicate_estimate", { _estimate_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estimates"] }); toast({ title: "Estimate duplicated" }); },
    onError: (e: any) => toast({ title: "Duplicate failed", description: e.message, variant: "destructive" }),
  });
}

export function useArchiveEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimates").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["estimate", id] });
      toast({ title: "Archived" });
    },
  });
}

export function useDeleteEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estimates"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}

export function useConvertEstimateToJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { estimate_id: string; mode: "new" | "attach"; existing_job_id?: string }) => {
      const { data, error } = await supabase.rpc("convert_estimate_to_job", {
        _estimate_id: args.estimate_id,
        _mode: args.mode,
        _existing_job_id: args.existing_job_id ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r as { success: boolean; job_id: string };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate", vars.estimate_id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Converted to job", description: `Job created/updated.` });
    },
    onError: (e: any) => toast({ title: "Convert failed", description: e.message, variant: "destructive" }),
  });
}

// Manual admin overrides for status (mark accepted/declined manually)
export function useManualAcceptEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; package_id: string; total: number; deposit?: number }) => {
      const { error } = await supabase.from("estimates").update({
        status: "Accepted",
        accepted_package_id: args.package_id,
        accepted_at: new Date().toISOString(),
        accepted_total: args.total,
        accepted_deposit: args.deposit ?? 0,
      }).eq("id", args.id);
      if (error) throw error;
      // Mark package as selected
      await supabase.from("estimate_packages").update({ is_selected: false }).eq("estimate_id", args.id);
      await supabase.from("estimate_packages").update({ is_selected: true }).eq("id", args.package_id);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate", vars.id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["estimate_packages", vars.id] });
      toast({ title: "Estimate accepted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

export function useManualDeclineEstimate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; reason?: string }) => {
      const { error } = await supabase.from("estimates").update({
        status: "Declined",
        declined_at: new Date().toISOString(),
        decline_reason: args.reason || "",
      }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate", vars.id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      toast({ title: "Estimate declined" });
    },
  });
}

// Public token-based fetch (no auth required)
export async function fetchEstimateByToken(token: string) {
  const { data, error } = await supabase.rpc("get_estimate_by_token", { _token: token });
  if (error) throw error;
  return data as any;
}

export async function customerAcceptEstimate(args: {
  token: string; package_id: string; selected_item_ids: string[]; total: number; deposit: number;
}) {
  const { data, error } = await supabase.rpc("customer_accept_estimate", {
    _token: args.token,
    _package_id: args.package_id,
    _selected_item_ids: args.selected_item_ids,
    _accepted_total: args.total,
    _accepted_deposit: args.deposit,
  });
  if (error) throw error;
  const r = data as any;
  if (r?.error) throw new Error(r.error);
  return r;
}

export async function customerDeclineEstimate(token: string, reason: string) {
  const { data, error } = await supabase.rpc("customer_decline_estimate", { _token: token, _reason: reason });
  if (error) throw error;
  const r = data as any;
  if (r?.error) throw new Error(r.error);
  return r;
}

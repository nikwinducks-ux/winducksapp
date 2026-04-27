import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  status: string;
  job_id: string | null;
  customer_id: string | null;
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  total: number;
  notes: string;
  payment_terms: string;
  share_token: string;
  pdf_storage_path: string;
  sent_at: string | null;
  paid_at: string | null;
  payment_method: string;
  payment_reference: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerInvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  display_order: number;
}

export function useCustomerInvoices() {
  return useQuery({
    queryKey: ["customer_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomerInvoice[];
    },
  });
}

export function useCustomerInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["customer_invoice", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as CustomerInvoice | null;
    },
  });
}

export function useCustomerInvoiceLineItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["customer_invoice_line_items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CustomerInvoiceLineItem[];
    },
  });
}

export function useConvertJobToInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.rpc("convert_job_to_invoice", { _job_id: jobId });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      return result as { success: boolean; invoice_id: string; invoice_number?: string; reused?: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: result.reused ? "Draft invoice reused" : "Invoice created",
        description: result.invoice_number ? `Invoice ${result.invoice_number} ready for review.` : "Draft invoice ready for review.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useSaveInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: {
      invoiceId: string;
      patch: Partial<CustomerInvoice>;
      lineItems: Array<Pick<CustomerInvoiceLineItem, "id" | "description" | "quantity" | "unit_price" | "line_total" | "display_order">>;
    }) => {
      const { invoiceId, patch, lineItems } = args;

      // Recompute totals from line items
      const subtotal = lineItems.reduce((s, l) => s + Number(l.line_total || 0), 0);
      const taxPct = Number(patch.tax_pct ?? 0);
      const taxAmount = Math.round(subtotal * taxPct) / 100;
      const total = subtotal + taxAmount;

      const { error: upErr } = await supabase
        .from("customer_invoices")
        .update({
          ...patch,
          subtotal,
          tax_amount: taxAmount,
          total,
        })
        .eq("id", invoiceId);
      if (upErr) throw upErr;

      // Replace line items
      const { error: delErr } = await supabase
        .from("customer_invoice_line_items")
        .delete()
        .eq("invoice_id", invoiceId);
      if (delErr) throw delErr;

      if (lineItems.length > 0) {
        const { error: insErr } = await supabase
          .from("customer_invoice_line_items")
          .insert(
            lineItems.map((l, i) => ({
              invoice_id: invoiceId,
              description: l.description,
              quantity: Number(l.quantity || 0),
              unit_price: Number(l.unit_price || 0),
              line_total: Number(l.line_total || 0),
              display_order: i,
            }))
          );
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoice", vars.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["customer_invoice_line_items", vars.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      toast({ title: "Invoice saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useMarkInvoiceSent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.rpc("mark_customer_invoice_sent", {
        _invoice_id: invoiceId,
        _pdf_path: "",
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Marked as sent" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useSendInvoiceEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke("send-customer-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Invoice emailed", description: "Customer has been sent the invoice." });
    },
    onError: (err: any) => {
      toast({ title: "Email failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.from("customer_invoices").delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { invoiceId: string; method: string; reference: string }) => {
      const { error } = await supabase
        .from("customer_invoices")
        .update({
          status: "Paid",
          paid_at: new Date().toISOString(),
          payment_method: args.method,
          payment_reference: args.reference,
        })
        .eq("id", args.invoiceId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customer_invoice", vars.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["customer_invoices"] });
      toast({ title: "Marked as paid" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });
}

// Public token-based fetch (no auth)
export async function fetchInvoiceByToken(token: string) {
  const { data, error } = await supabase.rpc("get_customer_invoice_by_token", { _token: token });
  if (error) throw error;
  return data as any;
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkflowEvent {
  id: string;
  created_at: string;
  type: string;
  title: string;
  details?: string;
  actor?: string;
}

function fmtType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useEstimateEvents(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["estimate_events", estimateId],
    queryFn: async () => {
      if (!estimateId) return [] as WorkflowEvent[];
      const { data, error } = await supabase
        .from("estimate_events")
        .select("id,event_type,details,created_at")
        .eq("estimate_id", estimateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        id: e.id,
        created_at: e.created_at,
        type: e.event_type,
        title: fmtType(e.event_type),
        details: e.details ? Object.entries(e.details)
          .filter(([k]) => !["actor","actor_user_id"].includes(k))
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join(" · ") : undefined,
      })) as WorkflowEvent[];
    },
    enabled: !!estimateId,
  });
}

export function useJobTimeline(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_timeline", jobId],
    queryFn: async () => {
      if (!jobId) return [] as WorkflowEvent[];
      const [statusRes, assignRes] = await Promise.all([
        supabase.from("job_status_events").select("id,old_status,new_status,note,changed_at").eq("job_id", jobId),
        supabase.from("job_assignments").select("id,sp_id,assignment_type,assigned_at,notes").eq("job_id", jobId),
      ]);
      const events: WorkflowEvent[] = [];
      (statusRes.data ?? []).forEach((e: any) => events.push({
        id: `s${e.id}`, created_at: e.changed_at, type: "status_change",
        title: `${e.old_status || "—"} → ${e.new_status}`,
        details: e.note || undefined,
      }));
      (assignRes.data ?? []).forEach((e: any) => events.push({
        id: `a${e.id}`, created_at: e.assigned_at, type: "assignment",
        title: `Assigned to SP (${e.assignment_type})`,
        details: e.notes || undefined,
      }));
      return events.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    enabled: !!jobId,
  });
}

export function useInvoiceTimeline(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_timeline", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [] as WorkflowEvent[];
      const [evRes, payRes] = await Promise.all([
        supabase.from("invoice_events").select("id,event_type,details,created_at").eq("invoice_id", invoiceId),
        supabase.from("invoice_payments").select("id,amount,method,reference,payment_date,created_at").eq("invoice_id", invoiceId),
      ]);
      const events: WorkflowEvent[] = [];
      (evRes.data ?? []).forEach((e: any) => events.push({
        id: `e${e.id}`, created_at: e.created_at, type: e.event_type, title: fmtType(e.event_type),
        details: e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(" · ") : undefined,
      }));
      (payRes.data ?? []).forEach((p: any) => events.push({
        id: `p${p.id}`, created_at: p.created_at, type: "payment",
        title: `Payment received: $${Number(p.amount).toFixed(2)}`,
        details: [p.method, p.reference].filter(Boolean).join(" · ") || undefined,
      }));
      return events.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    enabled: !!invoiceId,
  });
}

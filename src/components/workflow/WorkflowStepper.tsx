import { Link } from "react-router-dom";
import { Check, Circle, FileText, Briefcase, UserCheck, ClipboardCheck, Receipt, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStageKey =
  | "estimate_drafted"
  | "estimate_sent"
  | "estimate_accepted"
  | "job_created"
  | "job_assigned"
  | "job_completed"
  | "invoiced";

export type StageState = "done" | "current" | "upcoming" | "skipped";

export interface WorkflowStage {
  key: WorkflowStageKey;
  label: string;
  state: StageState;
  to?: string;
}

const ICONS: Record<WorkflowStageKey, any> = {
  estimate_drafted: FileText,
  estimate_sent: Send,
  estimate_accepted: Check,
  job_created: Briefcase,
  job_assigned: UserCheck,
  job_completed: ClipboardCheck,
  invoiced: Receipt,
};

export function WorkflowStepper({ stages }: { stages: WorkflowStage[] }) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {stages.map((stage, i) => {
          const Icon = ICONS[stage.key] ?? Circle;
          const isLast = i === stages.length - 1;
          const dotClass = cn(
            "flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-colors",
            stage.state === "done" && "bg-success text-success-foreground",
            stage.state === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/15",
            stage.state === "upcoming" && "bg-muted text-muted-foreground",
            stage.state === "skipped" && "bg-muted/50 text-muted-foreground/60",
          );
          const labelClass = cn(
            "text-xs font-medium whitespace-nowrap",
            stage.state === "current" && "text-foreground",
            stage.state === "done" && "text-foreground",
            (stage.state === "upcoming" || stage.state === "skipped") && "text-muted-foreground",
          );
          const inner = (
            <div className="flex items-center gap-2 min-w-0">
              <div className={dotClass}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={labelClass}>{stage.label}</span>
            </div>
          );
          return (
            <div key={stage.key} className="flex items-center gap-1 shrink-0">
              {stage.to && stage.state === "done" ? (
                <Link to={stage.to} className="hover:opacity-80 transition-opacity">
                  {inner}
                </Link>
              ) : (
                inner
              )}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Builders for each context ===

export function buildEstimateStages(estimate: {
  status: string;
  sent_at?: string | null;
  accepted_at?: string | null;
  converted_job_id?: string | null;
}, opts: { invoiceId?: string | null } = {}): WorkflowStage[] {
  const drafted: StageState = "done";
  const sent: StageState = estimate.sent_at || ["Sent","Viewed","Accepted","Declined","Expired","Converted"].includes(estimate.status) ? "done" : estimate.status === "Draft" ? "current" : "upcoming";
  const accepted: StageState = estimate.accepted_at ? "done" : estimate.status === "Declined" || estimate.status === "Expired" ? "skipped" : sent === "done" ? "current" : "upcoming";
  const jobCreated: StageState = estimate.converted_job_id ? "done" : accepted === "done" ? "current" : "upcoming";
  return [
    { key: "estimate_drafted", label: "Drafted", state: drafted },
    { key: "estimate_sent",    label: "Sent",    state: sent },
    { key: "estimate_accepted",label: "Accepted",state: accepted },
    { key: "job_created",      label: "Job",     state: jobCreated, to: estimate.converted_job_id ? `/admin/jobs/${estimate.converted_job_id}` : undefined },
    { key: "job_assigned",     label: "Assigned",state: jobCreated === "done" ? "upcoming" : "upcoming" },
    { key: "job_completed",    label: "Completed",state: "upcoming" },
    { key: "invoiced",         label: "Invoiced",state: opts.invoiceId ? "done" : "upcoming", to: opts.invoiceId ? `/admin/invoices/${opts.invoiceId}` : undefined },
  ];
}

export function buildJobStages(job: {
  status: string;
  assignedSpId?: string | null;
  source_estimate_id?: string | null;
}, opts: { estimateId?: string | null; invoiceId?: string | null } = {}): WorkflowStage[] {
  const hasEst = !!(opts.estimateId || job.source_estimate_id);
  const estId = opts.estimateId || job.source_estimate_id || null;
  const status = job.status;

  const estStates: StageState[] = hasEst
    ? ["done", "done", "done"]
    : ["skipped", "skipped", "skipped"];

  const jobCreated: StageState = "done";
  const assigned: StageState = job.assignedSpId
    ? "done"
    : ["Created","Offered"].includes(status) ? "current" : "upcoming";
  const completed: StageState = ["Completed","ReadyToInvoice","ConvertedToInvoice","InvoiceSent"].includes(status)
    ? "done"
    : assigned === "done" ? "current" : "upcoming";
  const invoiced: StageState = ["ConvertedToInvoice","InvoiceSent"].includes(status)
    ? "done"
    : completed === "done" ? "current" : "upcoming";

  return [
    { key: "estimate_drafted", label: "Drafted",   state: estStates[0], to: estId ? `/admin/estimates/${estId}` : undefined },
    { key: "estimate_sent",    label: "Sent",      state: estStates[1], to: estId ? `/admin/estimates/${estId}` : undefined },
    { key: "estimate_accepted",label: "Accepted",  state: estStates[2], to: estId ? `/admin/estimates/${estId}` : undefined },
    { key: "job_created",      label: "Job",       state: jobCreated },
    { key: "job_assigned",     label: "Assigned",  state: assigned },
    { key: "job_completed",    label: "Completed", state: completed },
    { key: "invoiced",         label: "Invoiced",  state: invoiced, to: opts.invoiceId ? `/admin/invoices/${opts.invoiceId}` : undefined },
  ];
}

export function buildInvoiceStages(invoice: {
  status: string;
  source_estimate_id?: string | null;
  job_id?: string | null;
  sent_at?: string | null;
  amount_paid?: number;
  total?: number;
}): WorkflowStage[] {
  const hasEst = !!invoice.source_estimate_id;
  const hasJob = !!invoice.job_id;

  const estStates: StageState[] = hasEst ? ["done","done","done"] : ["skipped","skipped","skipped"];
  const jobCreated: StageState = hasJob ? "done" : "skipped";
  const assigned: StageState = hasJob ? "done" : "skipped";
  const completed: StageState = hasJob ? "done" : "skipped";
  const status = invoice.status;
  const paid = (invoice.amount_paid ?? 0) >= (invoice.total ?? 0) && (invoice.total ?? 0) > 0;
  const invoicedDone = ["Sent","Viewed","Paid","PartiallyPaid","Overdue","Archived"].includes(status) || paid;
  const invoiced: StageState = invoicedDone ? "done" : status === "Draft" ? "current" : "upcoming";

  return [
    { key: "estimate_drafted", label: "Drafted",   state: estStates[0], to: invoice.source_estimate_id ? `/admin/estimates/${invoice.source_estimate_id}` : undefined },
    { key: "estimate_sent",    label: "Sent",      state: estStates[1], to: invoice.source_estimate_id ? `/admin/estimates/${invoice.source_estimate_id}` : undefined },
    { key: "estimate_accepted",label: "Accepted",  state: estStates[2], to: invoice.source_estimate_id ? `/admin/estimates/${invoice.source_estimate_id}` : undefined },
    { key: "job_created",      label: "Job",       state: jobCreated, to: invoice.job_id ? `/admin/jobs/${invoice.job_id}` : undefined },
    { key: "job_assigned",     label: "Assigned",  state: assigned, to: invoice.job_id ? `/admin/jobs/${invoice.job_id}` : undefined },
    { key: "job_completed",    label: "Completed", state: completed, to: invoice.job_id ? `/admin/jobs/${invoice.job_id}` : undefined },
    { key: "invoiced",         label: paid ? "Paid" : "Invoiced", state: invoiced },
  ];
}

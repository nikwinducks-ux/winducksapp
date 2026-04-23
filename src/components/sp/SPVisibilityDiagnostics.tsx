import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import type { Job } from "@/data/mockData";

interface Props {
  jobs: Job[];
  context: "my-jobs" | "calendar";
  queryState?: "idle" | "pending" | "loading" | "success" | "error";
  queryError?: string | null;
}

/**
 * Compact diagnostics card for SPs to verify what the data layer is returning.
 * Shows auth identity, resolved sp_id, raw fetched job count, and how many
 * match the current SP via assignment / crew. Helps localize "I can't see my
 * jobs" issues to either auth, RLS, or filter logic.
 */
export function SPVisibilityDiagnostics({ jobs, context, queryState, queryError }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user) return null;

  const spId = user.spId ?? null;
  const totalJobs = jobs.length;
  const assignedToMe = jobs.filter((j) => j.assignedSpId === spId).length;
  const onCrew = jobs.filter((j) => j.crew?.some((c) => c.spId === spId)).length;
  const myTotal = jobs.filter(
    (j) => j.assignedSpId === spId || j.crew?.some((c) => c.spId === spId)
  ).length;

  const summary =
    `[SP Visibility — ${context}]\n` +
    `auth_user_id: ${user.id}\n` +
    `email:        ${user.email}\n` +
    `role:         ${user.role}\n` +
    `sp_id:        ${spId ?? "(none)"}\n` +
    `is_active:    ${user.isActive}\n` +
    `query state:  ${queryState ?? "(unknown)"}\n` +
    `query error:  ${queryError ?? "(none)"}\n` +
    `jobs returned by query: ${totalJobs}\n` +
    `assigned to me:         ${assignedToMe}\n` +
    `crew member on:         ${onCrew}\n` +
    `my total:               ${myTotal}`;

  function copy() {
    navigator.clipboard.writeText(summary).catch(() => {});
  }

  const status =
    !spId
      ? { label: "No sp_id linked", tone: "destructive" as const }
      : totalJobs === 0
        ? { label: "Query returned 0 jobs", tone: "warning" as const }
        : myTotal === 0
          ? { label: "Jobs fetched but none match you", tone: "warning" as const }
          : { label: `${myTotal} of ${totalJobs} jobs match you`, tone: "ok" as const };

  const toneClasses =
    status.tone === "destructive"
      ? "border-destructive/30 bg-destructive/5"
      : status.tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-primary/20 bg-primary/5";

  return (
    <div className={`rounded-md border ${toneClasses} text-xs`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">SP Visibility Diagnostics</span>
          <span className="text-muted-foreground">· {status.label}</span>
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-background/60 rounded p-2 border">
            {summary}
          </pre>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copy} className="h-7 text-xs">
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-7 text-xs">
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

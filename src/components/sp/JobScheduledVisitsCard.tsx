import { useState } from "react";
import { CalendarPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useJobScheduledVisits,
  useCreateScheduledVisit,
  useUpdateScheduledVisit,
  useDeleteScheduledVisit,
  type JobScheduledVisit,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import ScheduledVisitDialog, { type ScheduledVisitValue } from "./ScheduledVisitDialog";
import type { Job } from "@/data/mockData";

function formatDateLong(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], {
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

interface Props {
  job: Job;
}

export function JobScheduledVisitsCard({ job }: Props) {
  const { user } = useAuth();
  const spId = user?.spId ?? null;
  const { data: visits = [] } = useJobScheduledVisits(job.dbId);
  const createVisit = useCreateScheduledVisit();
  const updateVisit = useUpdateScheduledVisit();
  const deleteVisit = useDeleteScheduledVisit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobScheduledVisit | null>(null);

  // SPs can only manage their own visits; only show this card to the job's
  // assigned SP / crew members.
  const isMyJob = !!spId && (job.assignedSpId === spId || (job.crew ?? []).some((c) => c.spId === spId));
  if (!isMyJob) return null;

  const myVisits = visits.filter((v) => v.spId === spId);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(v: JobScheduledVisit) {
    setEditing(v);
    setDialogOpen(true);
  }

  async function handleSave(v: ScheduledVisitValue) {
    if (!spId) return;
    if (v.id) {
      await updateVisit.mutateAsync({
        id: v.id, jobId: job.dbId, spId,
        visitDate: v.visitDate, startTime: v.startTime,
        durationMin: v.durationMin, note: v.note,
      });
    } else {
      await createVisit.mutateAsync({
        jobId: job.dbId, spId, userId: user?.id ?? null,
        visitDate: v.visitDate, startTime: v.startTime,
        durationMin: v.durationMin, note: v.note,
      });
    }
    setDialogOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!spId) return;
    await deleteVisit.mutateAsync({ id, jobId: job.dbId, spId });
    setDialogOpen(false);
    setEditing(null);
  }

  return (
    <div className="metric-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" /> Follow-up visits
          {myVisits.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({myVisits.length})</span>
          )}
        </h2>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Add visit
        </Button>
      </div>

      {myVisits.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Schedule additional visits if this job needs more work. They'll appear on your calendar.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {myVisits.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {formatDateLong(v.visitDate)} · {formatTime12(v.startTime)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {v.durationMin < 60 ? `${v.durationMin}m` : `${Math.round(v.durationMin / 60 * 10) / 10}h`}
                  </span>
                </p>
                {v.note && <p className="text-xs text-muted-foreground truncate">{v.note}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ScheduledVisitDialog
        open={dialogOpen}
        initial={editing ? {
          id: editing.id, visitDate: editing.visitDate,
          startTime: editing.startTime, durationMin: editing.durationMin, note: editing.note,
        } : null}
        jobLabel={`${job.id} · ${job.customerName}`}
        saving={createVisit.isPending || updateVisit.isPending}
        deleting={deleteVisit.isPending}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default JobScheduledVisitsCard;

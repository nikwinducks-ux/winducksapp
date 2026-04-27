import { useEffect, useMemo, useState } from "react";
import { Play, Square, Plus, CheckCircle2, Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useJobVisits,
  useStartVisit,
  useEndVisit,
  useUpdateJobStatus,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import type { Job } from "@/data/mockData";

function formatDuration(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

interface Props {
  job: Job;
  variant?: "page" | "panel";
}

export function JobVisitsCard({ job, variant = "page" }: Props) {
  const { user } = useAuth();
  const { data: visits = [] } = useJobVisits(job.dbId);
  const startVisit = useStartVisit();
  const endVisit = useEndVisit();
  const updateStatus = useUpdateJobStatus();

  const openVisit = useMemo(() => visits.find((v) => v.endedAt === null) ?? null, [visits]);
  const hasAnyVisit = visits.length > 0;
  const isCompleted = job.status === "Completed";
  const isCancelled = job.status === "Cancelled";

  // Live tick when a visit is open
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!openVisit) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openVisit?.id]);

  const liveSecs = openVisit
    ? Math.max(0, Math.floor((now - new Date(openVisit.startedAt).getTime()) / 1000))
    : 0;

  const totalSecs = visits.reduce((sum, v) => {
    if (v.endedAt && v.durationSecs != null) return sum + v.durationSecs;
    if (!v.endedAt) return sum + liveSecs;
    return sum;
  }, 0);

  const canAct = !!user?.spId && !isCompleted && !isCancelled;

  const handleStart = () => {
    if (!user?.spId) return;
    startVisit.mutate({ jobId: job.dbId, spId: user.spId });
  };

  const handleEnd = () => {
    if (!openVisit) return;
    endVisit.mutate({ visitId: openVisit.id, jobId: job.dbId });
  };

  const handleComplete = () => {
    if (!user?.spId) return;
    // If the job hasn't been accepted yet, the DB will reject Offered → Completed.
    // Surface a clearer hint than the raw trigger error.
    const effectiveOld =
      job.status === "Offered" ? "InProgress" : job.status;
    // Safety: if a visit is somehow still open, close it first
    if (openVisit) {
      endVisit.mutate(
        { visitId: openVisit.id, jobId: job.dbId },
        {
          onSuccess: () =>
            updateStatus.mutate({
              jobDbId: job.dbId,
              oldStatus: effectiveOld,
              newStatus: "Completed",
              spId: user.spId!,
            }),
        }
      );
      return;
    }
    updateStatus.mutate({
      jobDbId: job.dbId,
      oldStatus: effectiveOld,
      newStatus: "Completed",
      spId: user.spId,
    });
  };

  if (isCompleted || isCancelled) {
    if (!hasAnyVisit) return null;
    return <VisitsHistory visits={visits} totalSecs={totalSecs} />;
  }

  return (
    <>
      <div className="metric-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <Clock className="h-4 w-4" /> Visits
          </h2>
          {hasAnyVisit && (
            <span className="text-xs text-muted-foreground">
              Total {formatDuration(totalSecs)}
            </span>
          )}
        </div>

        {/* Live timer when a visit is in progress */}
        {openVisit && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Visit in progress</p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {formatDuration(liveSecs)}
              </p>
            </div>
            <span className="inline-flex h-3 w-3 rounded-full bg-primary animate-pulse" aria-hidden />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {!openVisit && !hasAnyVisit && (
            <Button
              size="lg"
              className="flex-1 h-12"
              onClick={handleStart}
              disabled={!canAct || startVisit.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              {startVisit.isPending ? "Starting..." : "Start Visit"}
            </Button>
          )}

          {openVisit && (
            <Button
              size="lg"
              variant="destructive"
              className="flex-1 h-12"
              onClick={handleEnd}
              disabled={endVisit.isPending}
            >
              <Square className="mr-2 h-4 w-4" />
              {endVisit.isPending ? "Ending..." : "End Visit"}
            </Button>
          )}

          {!openVisit && hasAnyVisit && (
            <>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-12"
                onClick={handleStart}
                disabled={!canAct || startVisit.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                {startVisit.isPending ? "Starting..." : "New Visit"}
              </Button>
              <Button
                size="lg"
                className="flex-1 h-12"
                onClick={handleComplete}
                disabled={!canAct || updateStatus.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {updateStatus.isPending ? "Completing..." : "Complete Job"}
              </Button>
            </>
          )}
        </div>

        {hasAnyVisit && <VisitsHistoryInline visits={visits} liveSecs={liveSecs} />}
      </div>
    </>
  );
}

function VisitsHistoryInline({
  visits,
  liveSecs,
}: {
  visits: ReturnType<typeof useJobVisits>["data"] extends infer T ? NonNullable<T> : never;
  liveSecs: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <History className="h-3 w-3" /> History
      </p>
      <ul className="divide-y rounded-md border">
        {visits.map((v, i) => {
          const isOpen = v.endedAt === null;
          const dur = isOpen ? liveSecs : v.durationSecs ?? 0;
          return (
            <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  Visit {i + 1}
                  {isOpen && (
                    <span className="ml-2 text-xs font-normal text-primary">· in progress</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(v.startedAt)} · {formatTime(v.startedAt)}
                  {v.endedAt ? ` – ${formatTime(v.endedAt)}` : ""}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums">{formatDuration(dur)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VisitsHistory({
  visits,
  totalSecs,
}: {
  visits: ReturnType<typeof useJobVisits>["data"] extends infer T ? NonNullable<T> : never;
  totalSecs: number;
}) {
  return (
    <div className="metric-card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Clock className="h-4 w-4" /> Visits ({visits.length})
        </h2>
        <span className="text-xs text-muted-foreground">Total {formatDuration(totalSecs)}</span>
      </div>
      <VisitsHistoryInline visits={visits} liveSecs={0} />
    </div>
  );
}

export default JobVisitsCard;

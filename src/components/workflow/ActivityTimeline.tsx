import { Activity } from "lucide-react";
import type { WorkflowEvent } from "@/hooks/useWorkflowEvents";

export function ActivityTimeline({ events, loading, emptyMessage = "No activity yet." }: {
  events: WorkflowEvent[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  }
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((ev, i) => (
        <li key={ev.id} className="relative pl-6">
          <span className="absolute left-0 top-1 flex h-3 w-3 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {i !== events.length - 1 && (
              <span className="absolute top-3 h-full w-px bg-border" style={{ height: "calc(100% + 0.75rem)" }} />
            )}
          </span>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{ev.title}</p>
              {ev.details && (
                <p className="text-xs text-muted-foreground mt-0.5 break-words">{ev.details}</p>
              )}
            </div>
            <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {new Date(ev.created_at).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ActivityTimelineCard(props: Parameters<typeof ActivityTimeline>[0]) {
  return (
    <div className="metric-card space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <Activity className="h-4 w-4" /> Activity
      </h2>
      <ActivityTimeline {...props} />
    </div>
  );
}

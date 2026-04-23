import { cn } from "@/lib/utils";

const SCHEDULE_DEBUG_STORAGE_KEY = "lovable.scheduleDebug.enabled";

export function isScheduleDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SCHEDULE_DEBUG_STORAGE_KEY) === "1";
}

export function setScheduleDebugEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(SCHEDULE_DEBUG_STORAGE_KEY, "1");
  else window.localStorage.removeItem(SCHEDULE_DEBUG_STORAGE_KEY);
}

function parseLocalDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  const ampm = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const mins = parseInt(ampm[2] ?? "0", 10);
    if (h === 12) h = 0;
    if (ampm[3] === "pm") h += 12;
    return h * 60 + mins;
  }
  const h24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const mins = parseInt(h24[2], 10);
    if (h >= 0 && h < 24 && mins >= 0 && mins < 60) return h * 60 + mins;
  }
  return null;
}

function formatMinutes(mins: number | null): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface ScheduleDebugBadgeProps {
  scheduledDate?: string;
  scheduledTime?: string;
  className?: string;
}

/**
 * Tiny inline badge that prints the raw `scheduledDate` / `scheduledTime`
 * fields straight from the job row, plus the values they parse to.
 * Used to diagnose why a job does or does not appear at a given time.
 */
export function ScheduleDebugBadge({
  scheduledDate,
  scheduledTime,
  className,
}: ScheduleDebugBadgeProps) {
  const parsedDate = parseLocalDate(scheduledDate);
  const parsedMins = parseTimeToMinutes(scheduledTime);
  const dateOk = !!parsedDate;
  const timeOk = !scheduledTime || parsedMins != null;
  const allOk = dateOk && timeOk;

  return (
    <div
      className={cn(
        "mt-1 rounded border px-1.5 py-1 font-mono text-[10px] leading-tight",
        allOk
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-destructive/40 bg-destructive/5 text-destructive",
        className
      )}
      title="scheduledDate / scheduledTime values used to place this job"
    >
      <div>
        date: <span className="font-semibold">{scheduledDate || "∅"}</span>
        {" → "}
        {parsedDate ? parsedDate.toDateString() : <span className="font-semibold">parse fail</span>}
      </div>
      <div>
        time: <span className="font-semibold">{scheduledTime || "∅"}</span>
        {" → "}
        {scheduledTime
          ? parsedMins != null
            ? formatMinutes(parsedMins)
            : <span className="font-semibold">parse fail</span>
          : "untimed"}
      </div>
    </div>
  );
}

interface ScheduleDebugToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

export function ScheduleDebugToggle({ enabled, onChange, className }: ScheduleDebugToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        "text-xs px-2.5 py-1 rounded-full border transition-colors font-mono",
        enabled
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-muted-foreground border-border hover:bg-accent",
        className
      )}
      title="Show raw scheduledDate / scheduledTime values for each job"
    >
      {enabled ? "Debug: on" : "Debug: off"}
    </button>
  );
}

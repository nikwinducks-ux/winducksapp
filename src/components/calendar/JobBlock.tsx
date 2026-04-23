import type { Job } from "@/data/mockData";
import { cn } from "@/lib/utils";

export type JobAppearance = {
  /** Tailwind classes for background/border/text color */
  classes: string;
  /** Whether the block is awaiting acceptance (renders semi-transparent + dashed) */
  pending: boolean;
};

export function getJobAppearance(job: Job): JobAppearance {
  switch (job.status) {
    case "Created":
    case "Offered":
      return {
        pending: true,
        classes:
          "bg-primary/15 border-2 border-dashed border-primary/60 text-primary opacity-70 hover:opacity-90",
      };
    case "Assigned":
    case "Accepted":
      return {
        pending: false,
        classes: "bg-primary text-primary-foreground border border-primary hover:bg-primary/90",
      };
    case "InProgress":
      return {
        pending: false,
        classes: "bg-accent text-accent-foreground border border-accent hover:bg-accent/90",
      };
    case "Completed":
      return {
        pending: false,
        classes: "bg-success/90 text-success-foreground border border-success hover:bg-success",
      };
    case "Cancelled":
    case "Expired":
      return {
        pending: false,
        classes:
          "bg-muted text-muted-foreground border border-border line-through opacity-60",
      };
    default:
      return {
        pending: false,
        classes: "bg-secondary text-secondary-foreground border border-border",
      };
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "Created":
    case "Offered":
      return "Pending";
    case "Assigned":
    case "Accepted":
      return "Accepted";
    case "InProgress":
      return "In Progress";
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function formatShortTime(hhmm?: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (isNaN(h)) return "";
  const period = h >= 12 ? "p" : "a";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

interface JobBlockProps {
  job: Job;
  spName?: string;
  compact?: boolean;
  showTime?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function JobBlock({ job, spName, compact, showTime, onClick, className, style }: JobBlockProps) {
  const appearance = getJobAppearance(job);
  const timePrefix = showTime ? formatShortTime(job.scheduledTime) : "";
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "w-full text-left rounded-md px-2 py-1.5 text-xs transition-all shadow-sm overflow-hidden",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        appearance.classes,
        className
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold truncate">
          {timePrefix && <span className="opacity-80 mr-1">{timePrefix}</span>}
          {job.id}
        </span>
        <span className="font-semibold shrink-0">${job.payout}</span>
      </div>
      {!compact && (
        <>
          <div className="truncate font-medium">{job.customerName}</div>
          {job.scheduledTime && (
            <div className="truncate opacity-90">{job.scheduledTime}</div>
          )}
          <div className="truncate opacity-90">{statusLabel(job.status)}</div>
          {spName !== undefined && (
            <div className="truncate text-[10px] opacity-80">
              {spName || "Unassigned"}
            </div>
          )}
        </>
      )}
    </button>
  );
}

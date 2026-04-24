import { useDraggable } from "@dnd-kit/core";
import { formatCAD } from "@/lib/currency";
import type { Job } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { ScheduleDebugBadge } from "./ScheduleDebug";
import { getSpColor, type SpColor } from "./spColors";
import { isJobDraggable } from "./useCalendarDnd";

export type ColorMode = "sp" | "status";

export type JobAppearance = {
  /** Tailwind classes for background/border/text color */
  classes: string;
  /** Whether the block is awaiting acceptance (renders semi-transparent + dashed) */
  pending: boolean;
};

/** Status-based coloring (used in SP portal). */
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

/** SP-tinted coloring with status as visual modifier. */
function getSpJobAppearance(job: Job, spColor?: SpColor): JobAppearance & { showInProgressDot?: boolean; completedAccent?: boolean } {
  const sp = spColor ?? getSpColor(job.assignedSpId);

  switch (job.status) {
    case "Cancelled":
    case "Expired":
      // Suppress SP color entirely — job is dead.
      return {
        pending: false,
        classes:
          "bg-muted text-muted-foreground border border-border line-through opacity-60 grayscale",
      };
    case "Created":
    case "Offered":
      return {
        pending: true,
        classes: cn(
          sp.soft,
          "border-2 border-dashed opacity-75 hover:opacity-95"
        ),
      };
    case "Completed":
      return {
        pending: false,
        completedAccent: true,
        classes: cn(sp.solid, "border opacity-90"),
      };
    case "InProgress":
      return {
        pending: false,
        showInProgressDot: true,
        classes: cn(sp.solid, "border"),
      };
    case "Assigned":
    case "Accepted":
    default:
      return {
        pending: false,
        classes: cn(sp.solid, "border"),
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

export function formatShortTime(value?: string): string {
  if (!value) return "";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");

  const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2] ?? "0", 10);
    const period = ampmMatch[3] === "pm" ? "p" : "a";
    if (hours === 0) hours = 12;
    if (hours > 12) hours = hours % 12 || 12;
    return minutes === 0 ? `${hours}${period}` : `${hours}:${String(minutes).padStart(2, "0")}${period}`;
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHourMatch) {
    let hours = parseInt(twentyFourHourMatch[1], 10);
    const minutes = parseInt(twentyFourHourMatch[2] ?? "0", 10);
    if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
    const period = hours >= 12 ? "p" : "a";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return minutes === 0 ? `${hour12}${period}` : `${hour12}:${String(minutes).padStart(2, "0")}${period}`;
  }

  return value;
}

interface JobBlockProps {
  job: Job;
  spName?: string;
  compact?: boolean;
  showTime?: boolean;
  showDebug?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** "sp" tints by SP identity (admin), "status" colors by job status (SP portal). Default: "status". */
  colorMode?: ColorMode;
  /** When true, the block becomes draggable via @dnd-kit (admin only). */
  enableDnd?: boolean;
  /** Optional override resolver for SP color (honors admin-picked palette). */
  spColor?: SpColor;
}

export function JobBlock({
  job,
  spName,
  compact,
  showTime,
  showDebug,
  onClick,
  className,
  style,
  colorMode = "status",
  enableDnd = false,
  spColor,
}: JobBlockProps) {
  const draggable = enableDnd && isJobDraggable(job);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.dbId,
    disabled: !draggable,
  });

  const spAppearance = colorMode === "sp" ? getSpJobAppearance(job, spColor) : null;
  const appearance = spAppearance ?? getJobAppearance(job);
  const timePrefix = showTime ? formatShortTime(job.scheduledTime) : "";
  const customerTitle = job.customerName?.trim() || "Unassigned customer";
  const showInProgressDot = spAppearance?.showInProgressDot;
  const completedAccent = spAppearance?.completedAccent;

  return (
    <button
      ref={draggable ? setNodeRef : undefined}
      type="button"
      onClick={onClick}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "relative w-full text-left rounded-md px-2 py-1.5 text-xs transition-all shadow-sm overflow-hidden",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        appearance.classes,
        completedAccent && "border-l-4 border-l-success",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 ring-2 ring-primary",
        className
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold truncate flex items-center gap-1 min-w-0">
          {showInProgressDot && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
          )}
          {timePrefix && <span className="opacity-80 mr-0.5">{timePrefix}</span>}
          <span className="truncate">{customerTitle}</span>
          {job.crew && job.crew.length > 1 && (
            <span className="ml-1 shrink-0 rounded-sm bg-current/20 px-1 text-[9px] font-bold leading-tight">
              +{job.crew.length - 1}
            </span>
          )}
        </span>
        <span className="font-semibold shrink-0">{formatCAD(job.payout)}</span>
      </div>
      {!compact && (
        <>
          <div className="truncate text-[10px] opacity-75">{job.id}</div>
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
      {showDebug && (
        <ScheduleDebugBadge
          scheduledDate={job.scheduledDate}
          scheduledTime={job.scheduledTime}
        />
      )}
    </button>
  );
}


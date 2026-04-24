import { useEffect, useMemo, useRef, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Job, ServiceProvider } from "@/data/mockData";
import { JobBlock, getJobAppearance, type ColorMode } from "./JobBlock";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSpColor, type SpColor } from "./spColors";
import { cn } from "@/lib/utils";
import {
  useCalendarDnd,
  formatGhostTime,
  yToSnappedMinutes,
  minutesToHHMM,
  type RescheduleHandler,
} from "./useCalendarDnd";
import type { SpUnavailableBlock } from "@/hooks/useSpUnavailable";

export type CalendarView = "day" | "week" | "month";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const HOUR_PX = 60;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const GRID_HEIGHT_PX = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;

interface JobCalendarProps {
  jobs: Job[];
  providers: ServiceProvider[];
  view: CalendarView;
  currentDate: Date;
  onJobClick: (job: Job) => void;
  onEmptyDayClick?: (date: Date) => void;
  mode: "admin" | "sp";
  showDebug?: boolean;
  /** Nearest scheduled job date OUTSIDE the visible range, for empty-state jumps. */
  nearestPrevious?: Date | null;
  nearestNext?: Date | null;
  nearestPreviousLabel?: string | null;
  nearestNextLabel?: string | null;
  onJumpToDate?: (date: Date) => void;
  /** Enables drag-and-drop rescheduling (admin only). */
  enableDnd?: boolean;
  onReschedule?: RescheduleHandler;
  onDragBlocked?: (job: Job, reason: string) => void;
  /** Time-off blocks (rendered as striped bands). */
  unavailableBlocks?: SpUnavailableBlock[];
  /** Click an existing unavailable block. */
  onUnavailableClick?: (block: SpUnavailableBlock) => void;
  /** SP-only: drag empty grid space to create an unavailable block. */
  onCreateUnavailable?: (date: Date, start: string, end: string) => void;
  /** Tap a day in month view to drill into Day view. */
  onDayClick?: (date: Date) => void;
}


function spNameLookup(providers: ServiceProvider[]) {
  const map = new Map(providers.map((p) => [p.id, p.name]));
  return (id?: string) => (id ? map.get(id) ?? "Unknown SP" : "Unassigned");
}

function spColorLookup(providers: ServiceProvider[]) {
  const map = new Map(providers.map((p) => [p.id, p.calendarColor ?? null]));
  return (id?: string): SpColor => getSpColor(id, id ? map.get(id) ?? null : null);
}

/** Parse a Postgres `date` string ("YYYY-MM-DD") as a local date to avoid TZ shifts. */
function parseLocalDate(s: string): Date {
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return new Date(Number.NaN);
  const year = parseInt(isoMatch[1], 10);
  const month = parseInt(isoMatch[2], 10);
  const day = parseInt(isoMatch[3], 10);
  return new Date(year, month - 1, day);
}

import { formatCADWhole } from "@/lib/currency";

function formatDayTotal(jobs: Job[]): string | null {
  if (!jobs.length) return null;
  const total = jobs.reduce((sum, j) => sum + (Number(j.payout) || 0), 0);
  if (total <= 0) return null;
  return formatCADWhole(total);
}

function formatCompactCAD(jobs: Job[]): string | null {
  if (!jobs.length) return null;
  const total = jobs.reduce((sum, j) => sum + (Number(j.payout) || 0), 0);
  if (total <= 0) return null;
  if (total < 1000) return `$${Math.round(total)}`;
  if (total < 10000) return `$${(total / 1000).toFixed(1)}k`;
  return `$${Math.round(total / 1000)}k`;
}

function jobsOnDate(jobs: Job[], date: Date) {
  return jobs
    .filter((j) => j.scheduledDate && isSameDay(parseLocalDate(j.scheduledDate), date))
    .sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.scheduledTime);
      const bMinutes = parseTimeToMinutes(b.scheduledTime);
      if (aMinutes == null && bMinutes == null) return (a.scheduledTime || "").localeCompare(b.scheduledTime || "");
      if (aMinutes == null) return -1;
      if (bMinutes == null) return 1;
      return aMinutes - bMinutes;
    });
}

function blocksOnDate(blocks: SpUnavailableBlock[] | undefined, date: Date): SpUnavailableBlock[] {
  if (!blocks?.length) return [];
  return blocks.filter((b) => isSameDay(parseLocalDate(b.date), date));
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmmToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");

  const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2] ?? "0", 10);
    const period = ampmMatch[3];
    if (hours === 12) hours = 0;
    if (period === "pm") hours += 12;
    return hours * 60 + minutes;
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHourMatch) {
    const hours = parseInt(twentyFourHourMatch[1], 10);
    const minutes = parseInt(twentyFourHourMatch[2] ?? "0", 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

function parseDurationMinutes(d?: string): number {
  if (!d) return 60;
  // Try formats like "2h", "90m", "1h 30m", "1.5h", or plain number ("60")
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?/gi;
  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    matched = true;
    const val = parseFloat(match[1]);
    const unit = (match[2] ?? "").toLowerCase();
    if (unit.startsWith("h")) total += val * 60;
    else total += val; // minutes (or unitless treated as minutes)
  }
  if (!matched || total <= 0) return 60;
  return total;
}

type Positioned = {
  job: Job;
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
};

/** Categorize jobs for a single day into outside-hours, untimed, and grid items with overlap lanes. */
function categorizeDayJobs(jobs: Job[]): {
  untimed: Job[];
  outside: Job[];
  grid: Positioned[];
} {
  const startBound = DAY_START_HOUR * 60;
  const endBound = DAY_END_HOUR * 60;
  const untimed: Job[] = [];
  const outside: Job[] = [];
  const inGrid: { job: Job; startMin: number; endMin: number }[] = [];

  for (const job of jobs) {
    const mins = parseTimeToMinutes(job.scheduledTime);
    if (mins == null) {
      untimed.push(job);
      continue;
    }
    if (mins < startBound || mins >= endBound) {
      outside.push(job);
      continue;
    }
    const dur = parseDurationMinutes(job.estimatedDuration);
    inGrid.push({
      job,
      startMin: mins,
      endMin: Math.min(endBound, mins + dur),
    });
  }

  // Sort and group overlapping intervals; assign lanes per cluster.
  inGrid.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const grid: Positioned[] = [];
  let cluster: typeof inGrid = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    // Greedy lane assignment within the cluster.
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[lane] = item.endMin;
      }
      return { ...item, lane };
    });
    const laneCount = laneEnds.length;
    for (const a of assigned) {
      grid.push({ ...a, laneCount });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of inGrid) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return { untimed, outside, grid };
}

export function JobCalendar(props: JobCalendarProps) {
  const dnd = useCalendarDnd({
    enabled: !!props.enableDnd && !!props.onReschedule,
    jobs: props.jobs,
    onReschedule: props.onReschedule ?? (() => {}),
    onBlocked: props.onDragBlocked,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const inner =
    props.view === "day" ? (
      <DayView {...props} dnd={dnd} />
    ) : props.view === "week" ? (
      <WeekView {...props} dnd={dnd} />
    ) : (
      <MonthView {...props} dnd={dnd} />
    );

  if (!dnd.enabled) return inner;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      {inner}
      {dnd.activeJob && dnd.ghostLabel && (
        <GhostTimeBadge label={dnd.ghostLabel} pointerRef={dnd.pointerRef} />
      )}
    </DndContext>
  );
}

type DndApi = ReturnType<typeof useCalendarDnd>;

function GhostTimeBadge({
  label,
  pointerRef,
}: {
  label: string;
  pointerRef: React.MutableRefObject<{ x: number; y: number } | null>;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(pointerRef.current);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (pointerRef.current) setPos({ ...pointerRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef]);
  if (!pos) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md bg-foreground text-background px-2 py-1 text-xs font-medium shadow-lg"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      {label}
    </div>
  );
}

// ===== Now line hook =====
function useNowMinutes() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return { now, minutes: now.getHours() * 60 + now.getMinutes() };
}

// ===== Time Axis =====
function TimeAxis() {
  return (
    <div className="w-14 shrink-0 border-r bg-muted/20 text-[10px] text-muted-foreground select-none">
      <div style={{ height: HOUR_PX / 2 }} />
      {HOURS.map((h) => {
        const period = h >= 12 ? "PM" : "AM";
        const hr12 = h % 12 === 0 ? 12 : h % 12;
        return (
          <div
            key={h}
            style={{ height: HOUR_PX }}
            className="relative border-t border-border/60 -mt-px"
          >
            <span className="absolute -top-2 right-1.5 bg-muted/20 px-1">
              {hr12}
              {period}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===== Day Column with grid =====
interface DayColumnProps {
  date: Date;
  jobs: Job[];
  blocks: SpUnavailableBlock[];
  getSpName: (id?: string) => string;
  getSpColorFor: (id?: string) => SpColor;
  showSp: boolean;
  compact: boolean;
  showDebug?: boolean;
  colorMode: ColorMode;
  onJobClick: (job: Job) => void;
  onUnavailableClick?: (block: SpUnavailableBlock) => void;
  onCreateUnavailable?: (date: Date, start: string, end: string) => void;
  onEmptyDayClick?: (date: Date) => void;
  showAddAffordance: boolean;
  dnd?: DndApi;
  mode: "admin" | "sp";
}

function DayColumn({
  date,
  jobs,
  blocks,
  getSpName,
  getSpColorFor,
  showSp,
  compact,
  showDebug,
  colorMode,
  onJobClick,
  onUnavailableClick,
  onCreateUnavailable,
  onEmptyDayClick,
  showAddAffordance,
  dnd,
  mode,
}: DayColumnProps) {
  const { untimed, outside, grid } = useMemo(() => categorizeDayJobs(jobs), [jobs]);
  const today = isToday(date);
  const { minutes: nowMin } = useNowMinutes();
  const showNowLine =
    today && nowMin >= DAY_START_HOUR * 60 && nowMin < DAY_END_HOUR * 60;
  const nowTop = (nowMin - DAY_START_HOUR * 60);
  const dndEnabled = !!dnd?.enabled;

  return (
    <div className="flex-1 min-w-0 border-r last:border-r-0 flex flex-col">
      {/* Top strip for untimed / outside-hours / add affordance */}
      {(untimed.length > 0 || outside.length > 0 || showAddAffordance) && (
        <div className="border-b bg-muted/10 p-1 space-y-1">
          {untimed.map((job) => (
            <div key={`u-${job.dbId}`} className="relative">
              <div className="text-[9px] uppercase text-muted-foreground px-1">No time</div>
              <JobBlock
                job={job}
                compact={compact}
                showDebug={showDebug}
                colorMode={colorMode}
                spName={showSp ? getSpName(job.assignedSpId) : undefined}
                spColor={getSpColorFor(job.assignedSpId)}
                onClick={() => onJobClick(job)}
                enableDnd={dndEnabled}
              />
            </div>
          ))}
          {outside.map((job) => (
            <div key={`o-${job.dbId}`} className="relative">
              <div className="text-[9px] uppercase text-muted-foreground px-1">
                Outside hours · {job.scheduledTime}
              </div>
              <JobBlock
                job={job}
                compact={compact}
                showDebug={showDebug}
                colorMode={colorMode}
                spName={showSp ? getSpName(job.assignedSpId) : undefined}
                spColor={getSpColorFor(job.assignedSpId)}
                onClick={() => onJobClick(job)}
                enableDnd={dndEnabled}
              />
            </div>
          ))}
          {showAddAffordance && jobs.length === 0 && onEmptyDayClick && (
            <button
              type="button"
              onClick={() => onEmptyDayClick(date)}
              className="w-full text-[10px] text-muted-foreground hover:text-primary hover:bg-accent/40 rounded py-1"
            >
              + Add
            </button>
          )}
        </div>
      )}

      <DayGridDroppable
        date={date}
        today={today}
        showNowLine={showNowLine}
        nowTop={nowTop}
        grid={grid}
        blocks={blocks}
        compact={compact}
        showDebug={showDebug}
        colorMode={colorMode}
        getSpName={getSpName}
        getSpColorFor={getSpColorFor}
        showSp={showSp}
        onJobClick={onJobClick}
        onUnavailableClick={onUnavailableClick}
        onCreateUnavailable={onCreateUnavailable}
        dnd={dnd}
        mode={mode}
      />
    </div>
  );
}

interface DayGridDroppableProps {
  date: Date;
  today: boolean;
  showNowLine: boolean;
  nowTop: number;
  grid: Positioned[];
  blocks: SpUnavailableBlock[];
  compact: boolean;
  showDebug?: boolean;
  colorMode: ColorMode;
  getSpName: (id?: string) => string;
  getSpColorFor: (id?: string) => SpColor;
  showSp: boolean;
  onJobClick: (job: Job) => void;
  onUnavailableClick?: (block: SpUnavailableBlock) => void;
  onCreateUnavailable?: (date: Date, start: string, end: string) => void;
  dnd?: DndApi;
  mode: "admin" | "sp";
}

function DayGridDroppable({
  date, today, showNowLine, nowTop, grid, blocks, compact, showDebug, colorMode,
  getSpName, getSpColorFor, showSp, onJobClick, onUnavailableClick, onCreateUnavailable, dnd, mode,
}: DayGridDroppableProps) {
  const dndEnabled = !!dnd?.enabled;
  const { setNodeRef, isOver, node } = useDroppable({
    id: `day-grid:${date.toISOString()}`,
    data: { kind: "day-grid", date },
    disabled: !dndEnabled,
  });

  // Live ghost label while hovering this droppable.
  useEffect(() => {
    if (!dndEnabled || !dnd) return;
    if (!isOver || !dnd.activeJob) {
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = node.current;
      const ptr = dnd.pointerRef.current;
      if (el && ptr) {
        const rect = el.getBoundingClientRect();
        const yWithin = ptr.y - rect.top;
        const snapped = yToSnappedMinutes(yWithin);
        const dayLabel = format(date, "EEE");
        dnd.updateGhost(`${dayLabel} ${formatGhostTime(snapped)}`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isOver, dndEnabled, dnd, node, date]);

  // Tap-to-create unavailable (SP-only)
  const createEnabled = !!onCreateUnavailable;

  function onGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!createEnabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-jobblock]")) return;
    if (target.closest("[data-unavailable-block]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMin = yToSnappedMinutes(y);
    const dayEndMin = DAY_END_HOUR * 60;
    let endMin = Math.min(startMin + 60, dayEndMin);
    if (endMin - startMin < 15) endMin = startMin + 15;
    onCreateUnavailable?.(date, minutesToHHMM(startMin), minutesToHHMM(endMin));
  }

  return (
    <div
      ref={setNodeRef}
      onClick={onGridClick}
      className={cn(
        "relative flex-1",
        today && "bg-primary/5",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
        createEnabled && "cursor-pointer"
      )}
      style={{ height: GRID_HEIGHT_PX }}
    >
      {HOURS.map((h) => (
        <div
          key={h}
          className="border-t border-border/40"
          style={{ height: HOUR_PX }}
        />
      ))}

      {/* Unavailable blocks (under jobs) */}
      {blocks.map((b) => {
        const sm = hhmmToMin(b.start);
        const em = hhmmToMin(b.end);
        const top = Math.max(0, sm - DAY_START_HOUR * 60);
        const height = Math.max(15, Math.min(GRID_HEIGHT_PX - top, em - sm));
        const tint = mode === "admin" && b.spColor ? b.spColor : "hsl(var(--muted-foreground))";
        const label = mode === "admin" && b.spName ? `${b.spName} — Unavailable` : "Unavailable";
        return (
          <button
            type="button"
            key={b.id}
            data-unavailable-block
            onClick={(e) => {
              e.stopPropagation();
              onUnavailableClick?.(b);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-0.5 right-0.5 z-[5] rounded-md border border-dashed text-left overflow-hidden hover:opacity-90 transition-opacity"
            style={{
              top,
              height,
              backgroundColor: `color-mix(in hsl, ${tint} 18%, transparent)`,
              borderColor: `color-mix(in hsl, ${tint} 55%, transparent)`,
              backgroundImage:
                "repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.10) 0 6px, transparent 6px 12px)",
            }}
            title={b.reason || label}
          >
            <div className="px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80 truncate">
              {label}
            </div>
            {b.reason && height > 28 && (
              <div className="px-1.5 text-[10px] text-muted-foreground truncate">
                {b.reason}
              </div>
            )}
          </button>
        );
      })}

      {/* In-progress drag overlay */}
      {drag && (
        <div
          className="absolute left-0.5 right-0.5 z-[6] rounded-md border border-foreground/40 pointer-events-none"
          style={{
            top: drag.startMin - DAY_START_HOUR * 60,
            height: drag.endMin - drag.startMin,
            backgroundColor: "hsl(var(--muted-foreground) / 0.18)",
            backgroundImage:
              "repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.18) 0 6px, transparent 6px 12px)",
          }}
        >
          <div className="px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            Unavailable · {formatGhostTime(drag.startMin)} – {formatGhostTime(drag.endMin)}
          </div>
        </div>
      )}

      {/* Now line */}
      {showNowLine && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: nowTop }}
        >
          <div className="h-px bg-destructive/70" />
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
        </div>
      )}

      {/* Grid jobs */}
      {grid.map((item) => {
        const top = item.startMin - DAY_START_HOUR * 60;
        const height = Math.max(30, item.endMin - item.startMin);
        const widthPct = 100 / item.laneCount;
        const leftPct = widthPct * item.lane;
        return (
          <div
            key={item.job.dbId}
            data-jobblock
            style={{
              position: "absolute",
              top,
              height,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
            }}
            className="z-10"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <JobBlock
              job={item.job}
              compact={compact}
              showDebug={showDebug}
              colorMode={colorMode}
              spName={showSp ? getSpName(item.job.assignedSpId) : undefined}
              spColor={getSpColorFor(item.job.assignedSpId)}
              onClick={() => onJobClick(item.job)}
              enableDnd={dndEnabled}
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ===== Empty range overlay (Day/Week) =====
interface EmptyRangeOverlayProps {
  message: string;
  nearestPrevious?: Date | null;
  nearestNext?: Date | null;
  nearestPreviousLabel?: string | null;
  nearestNextLabel?: string | null;
  onJumpToDate?: (date: Date) => void;
}

function EmptyRangeOverlay({
  message,
  nearestPrevious,
  nearestNext,
  nearestPreviousLabel,
  nearestNextLabel,
  onJumpToDate,
}: EmptyRangeOverlayProps) {
  const hasJump = (nearestPrevious || nearestNext) && onJumpToDate;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-md rounded-lg border bg-card/95 backdrop-blur px-5 py-4 text-center shadow-sm space-y-2">
        <div className="text-sm font-medium text-foreground">{message}</div>
        {nearestNext && nearestNextLabel && (
          <div className="text-xs text-muted-foreground">
            Next scheduled job: <span className="text-foreground font-medium">{nearestNextLabel}</span>
          </div>
        )}
        {hasJump && (
          <div className="flex items-center justify-center gap-2 pt-1">
            {nearestPrevious && onJumpToDate && (
              <button
                type="button"
                onClick={() => onJumpToDate(nearestPrevious)}
                className="text-xs px-2.5 py-1 rounded-md border bg-background hover:bg-accent transition-colors"
              >
                ← Jump to previous{nearestPreviousLabel ? ` (${nearestPreviousLabel})` : ""}
              </button>
            )}
            {nearestNext && onJumpToDate && (
              <button
                type="button"
                onClick={() => onJumpToDate(nearestNext)}
                className="text-xs px-2.5 py-1 rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Jump to next{nearestNextLabel ? ` (${nearestNextLabel})` : ""} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Day View =====
type ViewProps = JobCalendarProps & { dnd?: DndApi };

function DayView({
  jobs, providers, currentDate, onJobClick, onEmptyDayClick, mode, showDebug,
  nearestPrevious, nearestNext, nearestPreviousLabel, nearestNextLabel, onJumpToDate,
  dnd, unavailableBlocks, onUnavailableClick, onCreateUnavailable,
}: ViewProps) {
  const getSpName = spNameLookup(providers);
  const getSpColorFor = spColorLookup(providers);
  const dayJobs = jobsOnDate(jobs, currentDate);
  const dayBlocks = blocksOnDate(unavailableBlocks, currentDate);
  const colorMode: ColorMode = mode === "admin" ? "sp" : "status";
  const showEmpty = dayJobs.length === 0 && (nearestPrevious || nearestNext);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium min-w-0 truncate">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
          {isToday(currentDate) && (
            <span className="ml-2 text-xs text-primary font-semibold">Today</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs text-muted-foreground">{dayJobs.length} job(s)</div>
          {formatDayTotal(dayJobs) && (
            <div className="text-xs font-semibold text-foreground bg-primary/10 text-primary rounded-md px-2 py-0.5">
              {formatDayTotal(dayJobs)}
            </div>
          )}
        </div>
      </div>
      <div className="relative flex overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <TimeAxis />
        <DayColumn
          date={currentDate}
          jobs={dayJobs}
          blocks={dayBlocks}
          getSpName={getSpName}
          getSpColorFor={getSpColorFor}
          showSp={mode === "admin"}
          compact={false}
          showDebug={showDebug}
          colorMode={colorMode}
          onJobClick={onJobClick}
          onUnavailableClick={onUnavailableClick}
          onCreateUnavailable={onCreateUnavailable}
          onEmptyDayClick={onEmptyDayClick}
          showAddAffordance={mode === "admin" && !!onEmptyDayClick}
          dnd={dnd}
          mode={mode}
        />
        {showEmpty && (
          <EmptyRangeOverlay
            message="No scheduled jobs on this day"
            nearestPrevious={nearestPrevious}
            nearestNext={nearestNext}
            nearestPreviousLabel={nearestPreviousLabel}
            nearestNextLabel={nearestNextLabel}
            onJumpToDate={onJumpToDate}
          />
        )}
      </div>
    </div>
  );
}

// ===== Week View =====
function WeekView({
  jobs, providers, currentDate, onJobClick, onEmptyDayClick, mode, showDebug,
  nearestPrevious, nearestNext, nearestPreviousLabel, nearestNextLabel, onJumpToDate,
  dnd, unavailableBlocks, onUnavailableClick, onCreateUnavailable,
}: ViewProps) {
  const getSpName = spNameLookup(providers);
  const getSpColorFor = spColorLookup(providers);
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const colorMode: ColorMode = mode === "admin" ? "sp" : "status";
  const totalWeekJobs = days.reduce((sum, d) => sum + jobsOnDate(jobs, d).length, 0);
  const showEmpty = totalWeekJobs === 0 && (nearestPrevious || nearestNext);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex border-b bg-muted/30">
        <div className="w-14 shrink-0 border-r" />
        {days.map((d) => {
          const headerDayJobs = jobsOnDate(jobs, d);
          const dayTotal = formatDayTotal(headerDayJobs);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex-1 min-w-0 px-2 py-2 text-center border-r last:border-r-0",
                isToday(d) && "bg-primary/10"
              )}
            >
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                {format(d, "EEE")}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  isToday(d) && "text-primary"
                )}
              >
                {format(d, "d")}
              </div>
              {dayTotal && (
                <div className="text-[10px] font-semibold text-primary mt-0.5 truncate">
                  {dayTotal}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative flex overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <TimeAxis />
        {days.map((d) => {
          const dayJobs = jobsOnDate(jobs, d);
          const dayBlocks = blocksOnDate(unavailableBlocks, d);
          return (
            <DayColumn
              key={d.toISOString()}
              date={d}
              jobs={dayJobs}
              blocks={dayBlocks}
              getSpName={getSpName}
              getSpColorFor={getSpColorFor}
              showSp={mode === "admin"}
              compact
              showDebug={showDebug}
              colorMode={colorMode}
              onJobClick={onJobClick}
              onUnavailableClick={onUnavailableClick}
              onCreateUnavailable={onCreateUnavailable}
              onEmptyDayClick={onEmptyDayClick}
              showAddAffordance={mode === "admin" && !!onEmptyDayClick}
              dnd={dnd}
              mode={mode}
            />
          );
        })}
        {showEmpty && (
          <EmptyRangeOverlay
            message="No scheduled jobs in this week"
            nearestPrevious={nearestPrevious}
            nearestNext={nearestNext}
            nearestPreviousLabel={nearestPreviousLabel}
            nearestNextLabel={nearestNextLabel}
            onJumpToDate={onJumpToDate}
          />
        )}
      </div>
    </div>
  );
}

// ===== Month View =====
function MonthView({ jobs, providers, currentDate, onJobClick, onEmptyDayClick, onDayClick, mode, showDebug, dnd }: ViewProps) {
  const getSpName = spNameLookup(providers);
  const getSpColorFor = spColorLookup(providers);
  const colorMode: ColorMode = mode === "admin" ? "sp" : "status";
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dndEnabled = !!dnd?.enabled;
  const isMobile = useIsMobile();

  const weekdays = useMemo(
    () =>
      isMobile
        ? ["M", "T", "W", "T", "F", "S", "S"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    [isMobile]
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekdays.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="px-1 sm:px-2 py-2 text-center text-[10px] uppercase text-muted-foreground font-semibold border-r last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const dayJobs = jobsOnDate(jobs, d);
          const inMonth = isSameMonth(d, currentDate);
          const visible = dayJobs.slice(0, 3);
          const overflow = dayJobs.length - visible.length;
          return (
            <MonthCell
              key={d.toISOString()}
              date={d}
              inMonth={inMonth}
              dayJobs={dayJobs}
              visible={visible}
              overflow={overflow}
              showDebug={showDebug}
              colorMode={colorMode}
              getSpName={getSpName}
              getSpColorFor={getSpColorFor}
              mode={mode}
              onJobClick={onJobClick}
              onEmptyDayClick={onEmptyDayClick}
              onDayClick={onDayClick}
              dndEnabled={dndEnabled}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

interface MonthCellProps {
  date: Date;
  inMonth: boolean;
  dayJobs: Job[];
  visible: Job[];
  overflow: number;
  showDebug?: boolean;
  colorMode: ColorMode;
  getSpName: (id?: string) => string;
  getSpColorFor: (id?: string) => SpColor;
  mode: "admin" | "sp";
  onJobClick: (job: Job) => void;
  onEmptyDayClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  dndEnabled: boolean;
  isMobile: boolean;
}

function MonthCell({
  date, inMonth, dayJobs, visible, overflow, showDebug, colorMode, getSpName, getSpColorFor,
  mode, onJobClick, onEmptyDayClick, onDayClick, dndEnabled, isMobile,
}: MonthCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `month-cell:${date.toISOString()}`,
    data: { kind: "month-cell", date },
    disabled: !dndEnabled,
  });

  const dayTotal = formatDayTotal(dayJobs);
  const dayTotalCompact = formatCompactCAD(dayJobs);
  const clickable = !!onDayClick;
  const mobileDots = dayJobs.slice(0, 2);
  const mobileOverflow = dayJobs.length - mobileDots.length;

  return (
    <div
      ref={setNodeRef}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onDayClick!(date) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDayClick!(date);
              }
            }
          : undefined
      }
      className={cn(
        "border-r border-b last:border-r-0 min-h-[64px] sm:min-h-[110px] p-0.5 sm:p-1 space-y-0.5 sm:space-y-1 transition-colors",
        !inMonth && "bg-muted/20",
        isToday(date) && "bg-primary/5",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
        clickable && "cursor-pointer hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
      )}
    >
      <div className={cn(
        "px-0.5 sm:px-1",
        isMobile
          ? "flex flex-col items-start gap-0"
          : "flex items-center justify-between gap-1"
      )}>
        <div
          className={cn(
            "text-xs font-semibold",
            !inMonth && "text-muted-foreground",
            isToday(date) && "text-primary"
          )}
        >
          {format(date, "d")}
        </div>
        {isMobile
          ? dayTotalCompact && (
              <div className="font-semibold text-primary text-[9px] leading-tight w-full">
                {dayTotalCompact}
              </div>
            )
          : dayTotal && (
              <div className="font-semibold text-primary truncate text-[10px]">
                {dayTotal}
              </div>
            )}
      </div>

      {isMobile ? (
        dayJobs.length > 0 && (
          <div className="flex items-center gap-1 px-0.5 flex-wrap">
            {mobileDots.map((job) => {
              const appearance = getJobAppearance(job);
              return (
                <button
                  key={job.dbId}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onJobClick(job); }}
                  className={cn(
                    "h-2 w-2 rounded-full border",
                    appearance.classes
                  )}
                  aria-label={`Job ${job.id}`}
                />
              );
            })}
            {mobileOverflow > 0 && (
              <span className="text-[9px] text-muted-foreground leading-none">
                +{mobileOverflow}
              </span>
            )}
          </div>
        )
      ) : (
        <>
          {visible.map((job) => (
            <div key={job.dbId} onClick={(e) => e.stopPropagation()}>
              <JobBlock
                job={job}
                compact
                showTime
                showDebug={showDebug}
                colorMode={colorMode}
                spName={mode === "admin" ? getSpName(job.assignedSpId) : undefined}
                spColor={getSpColorFor(job.assignedSpId)}
                onClick={() => onJobClick(job)}
                enableDnd={dndEnabled}
              />
            </div>
          ))}
          {overflow > 0 && (
            <div className="text-[10px] text-muted-foreground px-1">
              +{overflow} more
            </div>
          )}
          {dayJobs.length === 0 && inMonth && mode === "admin" && onEmptyDayClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEmptyDayClick(date); }}
              className="w-full text-[10px] text-muted-foreground/60 hover:text-primary py-1"
            >
              +
            </button>
          )}
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Job } from "@/data/mockData";

const SNAP_MINUTES = 15;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const HOUR_PX = 60;

export const DND_CONSTANTS = {
  SNAP_MINUTES,
  DAY_START_HOUR,
  DAY_END_HOUR,
  HOUR_PX,
};

const NON_DRAGGABLE_STATUSES = new Set(["Cancelled", "Expired"]);
const BLOCKED_WITH_TOAST_STATUSES = new Set(["InProgress", "Completed"]);

export function isJobDraggable(job: Job): boolean {
  return !NON_DRAGGABLE_STATUSES.has(job.status) && !BLOCKED_WITH_TOAST_STATUSES.has(job.status);
}

export function isJobBlockedWithToast(job: Job): boolean {
  return BLOCKED_WITH_TOAST_STATUSES.has(job.status);
}

/** Convert minutes since midnight → "HH:MM" 24h string. */
export function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format minutes since midnight → 12h label like "1:15 PM". */
export function formatGhostTime(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Snap a Y offset (px from grid top) to a 15-min slot, return minutes since midnight. */
export function yToSnappedMinutes(yPx: number): number {
  const rawMin = (yPx / HOUR_PX) * 60;
  const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
  const dayStartMin = DAY_START_HOUR * 60;
  const dayEndMin = DAY_END_HOUR * 60 - SNAP_MINUTES;
  return Math.max(dayStartMin, Math.min(dayEndMin, dayStartMin + snapped));
}

export function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DropTarget =
  | { kind: "day-grid"; date: Date; time: string }
  | { kind: "month-cell"; date: Date };

export type RescheduleHandler = (
  job: Job,
  dateISO: string,
  timeHHMM: string | null
) => void | Promise<void>;

interface UseCalendarDndOptions {
  enabled: boolean;
  jobs: Job[];
  onReschedule: RescheduleHandler;
  onBlocked?: (job: Job, reason: string) => void;
}

interface DragState {
  activeJob: Job | null;
  ghost: { x: number; y: number; label: string | null } | null;
}

export function useCalendarDnd({ enabled, jobs, onReschedule, onBlocked }: UseCalendarDndOptions) {
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [ghostLabel, setGhostLabel] = useState<string | null>(null);

  // Track pointer position globally during a drag for ghost label + Y math.
  useEffect(() => {
    if (!enabled || !activeJob) return;
    function onPointerMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [enabled, activeJob]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      const job = jobs.find((j) => j.dbId === id) ?? null;
      if (!job) return;
      if (isJobBlockedWithToast(job)) {
        onBlocked?.(job, "Cannot reschedule a job that has already started.");
        return;
      }
      setActiveJob(job);
    },
    [jobs, onBlocked]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const job = activeJob;
      setActiveJob(null);
      setGhostLabel(null);
      if (!job) return;
      const over = event.over;
      if (!over) return;

      const data = over.data.current as
        | { kind: "day-grid"; date: Date; rect?: DOMRect }
        | { kind: "month-cell"; date: Date }
        | undefined;
      if (!data) return;

      if (data.kind === "month-cell") {
        const iso = dateToISO(data.date);
        if (iso === job.scheduledDate) return;
        // Preserve time (may be empty/untimed).
        await onReschedule(job, iso, job.scheduledTime || null);
        return;
      }

      if (data.kind === "day-grid") {
        // Compute snapped time from final pointer Y vs droppable rect.
        const node = over.rect; // dnd-kit ClientRect
        if (!node) return;
        const pointerY = pointerRef.current?.y ?? node.top;
        const yWithin = pointerY - node.top;
        const snappedMin = yToSnappedMinutes(yWithin);
        const time = minutesToHHMM(snappedMin);
        const iso = dateToISO(data.date);
        if (iso === job.scheduledDate && time === job.scheduledTime) return;
        await onReschedule(job, iso, time);
      }
    },
    [activeJob, onReschedule]
  );

  // Update ghost label whenever pointer moves within a day-grid droppable.
  // We expose a setter the calendar grid calls on hover.
  const updateGhost = useCallback((label: string | null) => {
    setGhostLabel(label);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveJob(null);
    setGhostLabel(null);
  }, []);

  return {
    enabled,
    activeJob,
    ghostLabel,
    updateGhost,
    pointerRef,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

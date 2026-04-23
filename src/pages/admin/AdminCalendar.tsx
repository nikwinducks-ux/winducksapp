import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, format, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subMonths, subWeeks,
  isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  useJobs, useServiceProviders, useUpdateJob, useAssignJob, useJobCrew, useAssignCrew,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { CrewPicker, type CrewPickerValue } from "@/components/admin/CrewPicker";
import { JobCalendar, type CalendarView } from "@/components/calendar/JobCalendar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { statusLabel } from "@/components/calendar/JobBlock";
import { getSpColor, getUnassignedSpColor } from "@/components/calendar/spColors";
import {
  ScheduleDebugBadge,
  ScheduleDebugToggle,
  isScheduleDebugEnabled,
  setScheduleDebugEnabled,
} from "@/components/calendar/ScheduleDebug";
import type { Job } from "@/data/mockData";

const STATUS_FILTERS = [
  { id: "Pending", label: "Pending", matches: ["Created", "Offered"] },
  { id: "Accepted", label: "Accepted", matches: ["Assigned", "Accepted"] },
  { id: "InProgress", label: "In Progress", matches: ["InProgress"] },
  { id: "Completed", label: "Completed", matches: ["Completed"] },
] as const;

function parseLocalDate(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getBestCalendarStartDate(jobs: Job[]) {
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const datedJobs = jobs
    .map((job) => parseLocalDate(job.scheduledDate))
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (datedJobs.length === 0) return todayLocal;

  // Within ±30 days of today, pick the date with the most jobs
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const inWindow = datedJobs.filter(
    (d) => Math.abs(d.getTime() - todayLocal.getTime()) <= windowMs
  );
  if (inWindow.length > 0) {
    const counts = new Map<number, number>();
    for (const d of inWindow) {
      counts.set(d.getTime(), (counts.get(d.getTime()) ?? 0) + 1);
    }
    let best = inWindow[0];
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) {
        bestCount = c;
        best = new Date(t);
      }
    }
    return best;
  }

  // Otherwise, the nearest job in either direction
  return datedJobs.reduce((nearest, d) => {
    return Math.abs(d.getTime() - todayLocal.getTime()) <
      Math.abs(nearest.getTime() - todayLocal.getTime())
      ? d
      : nearest;
  }, datedJobs[0]);
}

function getViewRange(view: CalendarView, currentDate: Date): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === "week") {
    return {
      start: startOfWeek(currentDate, { weekStartsOn: 1 }),
      end: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }
  return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
}

export default function AdminCalendar() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const updateJob = useUpdateJob();
  const assignJob = useAssignJob();
  const assignCrew = useAssignCrew();
  const { toast } = useToast();
  const autoFocusedInitialDateRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [spFilter, setSpFilter] = useState<string>("all");
  const [statusFilters, setStatusFilters] = useState<string[]>(
    STATUS_FILTERS.map((s) => s.id)
  );
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editSp, setEditSp] = useState<string>("");
  const [sheetCrew, setSheetCrew] = useState<CrewPickerValue[]>([]);
  const [debug, setDebug] = useState(() => isScheduleDebugEnabled());

  function toggleDebug(next: boolean) {
    setDebug(next);
    setScheduleDebugEnabled(next);
  }

  const scheduledJobs = useMemo(() => {
    return jobs.filter((j) => !!j.scheduledDate);
  }, [jobs]);

  // ?date=YYYY-MM-DD takes precedence over auto-focus
  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam) return;
    const parsed = parseLocalDate(dateParam);
    if (parsed) {
      setCurrentDate(parsed);
      setView("day");
      autoFocusedInitialDateRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoFocusedInitialDateRef.current || scheduledJobs.length === 0) return;
    setCurrentDate(getBestCalendarStartDate(scheduledJobs));
    autoFocusedInitialDateRef.current = true;
  }, [scheduledJobs]);

  const filteredJobs = useMemo(() => {
    return scheduledJobs.filter((j) => {
      if (spFilter === "unassigned") {
        if (j.assignedSpId) return false;
      } else if (spFilter !== "all") {
        if (j.assignedSpId !== spFilter) return false;
      }
      const allowed = statusFilters.flatMap(
        (id) => STATUS_FILTERS.find((s) => s.id === id)?.matches ?? []
      );
      if (!allowed.includes(j.status)) return false;
      return true;
    });
  }, [scheduledJobs, spFilter, statusFilters]);

  // Range diagnostics: jobs in/out of view + nearest neighbours
  const rangeDiagnostics = useMemo(() => {
    const range = getViewRange(view, currentDate);
    const dated = filteredJobs
      .map((j) => ({ job: j, date: parseLocalDate(j.scheduledDate) }))
      .filter((x): x is { job: Job; date: Date } => !!x.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const inside = dated.filter(({ date }) =>
      isWithinInterval(date, { start: range.start, end: range.end })
    );
    const outside = dated.filter(
      ({ date }) => !isWithinInterval(date, { start: range.start, end: range.end })
    );
    const previous = [...outside]
      .filter(({ date }) => date.getTime() < range.start.getTime())
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    const next = outside
      .filter(({ date }) => date.getTime() > range.end.getTime())[0];

    return { range, inside, outside, previous: previous ?? null, next: next ?? null };
  }, [filteredJobs, view, currentDate]);

  const outOfViewInfo = rangeDiagnostics.outside.length > 0
    ? {
        count: rangeDiagnostics.outside.length,
        earliest: rangeDiagnostics.outside[0].date,
        latest: rangeDiagnostics.outside[rangeDiagnostics.outside.length - 1].date,
        previous: rangeDiagnostics.previous,
        next: rangeDiagnostics.next,
      }
    : null;

  // SP legend: unique SPs (and unassigned indicator) visible in the current filtered set.
  const legendEntries = useMemo(() => {
    if (spFilter !== "all" && spFilter !== "unassigned") return [];
    const seen = new Set<string>();
    let hasUnassigned = false;
    const entries: { id: string | null; name: string; swatch: string }[] = [];
    for (const j of filteredJobs) {
      if (!j.assignedSpId) {
        hasUnassigned = true;
        continue;
      }
      if (seen.has(j.assignedSpId)) continue;
      seen.add(j.assignedSpId);
      const provider = providers.find((p) => p.id === j.assignedSpId);
      entries.push({
        id: j.assignedSpId,
        name: provider?.name ?? "Unknown SP",
        swatch: getSpColor(j.assignedSpId, provider?.calendarColor ?? null).swatch,
      });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    if (hasUnassigned) {
      entries.push({ id: null, name: "Unassigned", swatch: getUnassignedSpColor().swatch });
    }
    return entries;
  }, [filteredJobs, providers, spFilter]);

  function jumpTo(date: Date) {
    setCurrentDate(date);
  }

  function navigate(direction: -1 | 1) {
    if (view === "day") setCurrentDate((d) => (direction === 1 ? addDays(d, 1) : subDays(d, 1)));
    else if (view === "week") setCurrentDate((d) => (direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
    else setCurrentDate((d) => (direction === 1 ? addMonths(d, 1) : subMonths(d, 1)));
  }

  function rangeLabel() {
    if (view === "day") return format(currentDate, "MMM d, yyyy");
    if (view === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }

  function openJob(job: Job) {
    setSelectedJob(job);
    setEditDate(job.scheduledDate ?? "");
    setEditTime(job.scheduledTime ?? "");
    setEditSp(job.assignedSpId ?? "unassigned");
    const crewSeed: CrewPickerValue[] = (job.crew ?? []).map((c) => ({
      spId: c.spId,
      isLead: c.isLead,
    }));
    setSheetCrew(crewSeed);
  }

  function toggleStatus(id: string) {
    setStatusFilters((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function saveSchedule() {
    if (!selectedJob) return;
    const ja = selectedJob.jobAddress;
    await updateJob.mutateAsync({
      id: selectedJob.dbId,
      customerId: selectedJob.customerId,
      serviceCategory: selectedJob.serviceCategory,
      payout: String(selectedJob.payout),
      street: ja.street, city: ja.city, province: ja.province,
      postalCode: ja.postalCode, country: ja.country,
      lat: ja.lat != null ? String(ja.lat) : "",
      lng: ja.lng != null ? String(ja.lng) : "",
      scheduledDate: editDate,
      scheduledTime: editTime,
      estimatedDuration: selectedJob.estimatedDuration,
      notes: selectedJob.notes ?? "",
      urgency: "Scheduled",
    });
    setSelectedJob(null);
  }

  async function unschedule() {
    if (!selectedJob) return;
    const ja = selectedJob.jobAddress;
    await updateJob.mutateAsync({
      id: selectedJob.dbId,
      customerId: selectedJob.customerId,
      serviceCategory: selectedJob.serviceCategory,
      payout: String(selectedJob.payout),
      street: ja.street, city: ja.city, province: ja.province,
      postalCode: ja.postalCode, country: ja.country,
      lat: ja.lat != null ? String(ja.lat) : "",
      lng: ja.lng != null ? String(ja.lng) : "",
      scheduledDate: "",
      scheduledTime: "",
      estimatedDuration: selectedJob.estimatedDuration,
      notes: selectedJob.notes ?? "",
      urgency: "Anytime soon",
    });
    toast({ title: "Job unscheduled", description: "Removed from calendar." });
    setSelectedJob(null);
  }

  async function reassign() {
    if (!selectedJob) return;
    try {
      await assignCrew.mutateAsync({
        jobId: selectedJob.dbId,
        members: sheetCrew,
        userId: user?.id ?? null,
      });
      toast({
        title: sheetCrew.length === 0 ? "Crew cleared" : "Crew updated",
        description: sheetCrew.length === 0
          ? "Job returned to Created."
          : `${sheetCrew.length} SP(s) assigned.`,
      });
      setSelectedJob(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleReschedule(job: Job, dateISO: string, timeHHMM: string | null) {
    if (job.status === "InProgress" || job.status === "Completed") {
      toast({
        title: "Cannot reschedule",
        description: "Cannot reschedule a job that has already started.",
        variant: "destructive",
      });
      return;
    }
    const ja = job.jobAddress;
    try {
      await updateJob.mutateAsync({
        id: job.dbId,
        customerId: job.customerId,
        serviceCategory: job.serviceCategory,
        payout: String(job.payout),
        street: ja.street, city: ja.city, province: ja.province,
        postalCode: ja.postalCode, country: ja.country,
        lat: ja.lat != null ? String(ja.lat) : "",
        lng: ja.lng != null ? String(ja.lng) : "",
        scheduledDate: dateISO,
        scheduledTime: timeHHMM ?? "",
        estimatedDuration: job.estimatedDuration,
        notes: job.notes ?? "",
        urgency: "Scheduled",
      });
      toast({
        title: "Rescheduled",
        description: `${job.id} → ${dateISO}${timeHHMM ? ` at ${timeHHMM}` : ""}`,
      });
    } catch (err) {
      toast({
        title: "Reschedule failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  function handleDragBlocked(_job: Job, reason: string) {
    toast({ title: "Cannot reschedule", description: reason, variant: "destructive" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and manage jobs across all service providers.
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-3 text-sm font-medium">{rangeLabel()}</span>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs">SP:</Label>
          <Select value={spFilter} onValueChange={setSpFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SPs</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const active = statusFilters.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStatus(s.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto">
          <ScheduleDebugToggle enabled={debug} onChange={toggleDebug} />
        </div>
      </div>

      {debug && (
        <div className="space-y-2">
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] font-mono text-muted-foreground">
            Showing raw <span className="font-semibold">scheduledDate</span> /{" "}
            <span className="font-semibold">scheduledTime</span> for each job below.
            Red = parse failed (job won't land at the right slot).
          </div>
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-[11px] font-mono text-foreground space-y-0.5">
            <div>range: {format(rangeDiagnostics.range.start, "yyyy-MM-dd")} → {format(rangeDiagnostics.range.end, "yyyy-MM-dd")} ({view})</div>
            <div>filtered scheduled jobs: {filteredJobs.length}</div>
            <div>in current range: {rangeDiagnostics.inside.length}</div>
            <div>outside current range: {rangeDiagnostics.outside.length}</div>
            <div>
              previous: {rangeDiagnostics.previous
                ? `${rangeDiagnostics.previous.job.id} @ ${format(rangeDiagnostics.previous.date, "yyyy-MM-dd")} ${rangeDiagnostics.previous.job.scheduledTime ?? ""}`
                : "—"}
            </div>
            <div>
              next: {rangeDiagnostics.next
                ? `${rangeDiagnostics.next.job.id} @ ${format(rangeDiagnostics.next.date, "yyyy-MM-dd")} ${rangeDiagnostics.next.job.scheduledTime ?? ""}`
                : "—"}
            </div>
          </div>
        </div>
      )}

      {outOfViewInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <div className="text-foreground space-y-0.5">
            <div>
              <span className="font-semibold">{outOfViewInfo.count}</span> scheduled job
              {outOfViewInfo.count === 1 ? " is" : "s are"} not in this view.
            </div>
            <div className="text-xs text-muted-foreground">
              {outOfViewInfo.next && (
                <>Nearest next: {format(outOfViewInfo.next.date, "MMM d, yyyy")}</>
              )}
              {outOfViewInfo.next && outOfViewInfo.previous && " · "}
              {outOfViewInfo.previous && (
                <>Nearest previous: {format(outOfViewInfo.previous.date, "MMM d, yyyy")}</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {outOfViewInfo.previous && (
              <Button size="sm" variant="outline" onClick={() => jumpTo(outOfViewInfo.previous!.date)}>
                ← Previous ({format(outOfViewInfo.previous.date, "MMM d")})
              </Button>
            )}
            {outOfViewInfo.next && (
              <Button size="sm" variant="outline" onClick={() => jumpTo(outOfViewInfo.next!.date)}>
                Next ({format(outOfViewInfo.next.date, "MMM d")}) →
              </Button>
            )}
          </div>
        </div>
      )}

      {legendEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground font-medium">SP colors:</span>
          {legendEntries.map((e) => (
            <span key={e.id ?? "unassigned"} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${e.swatch}`} />
              <span className="text-foreground">{e.name}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading calendar...</div>
      ) : (
        <JobCalendar
          jobs={filteredJobs}
          providers={providers}
          view={view}
          currentDate={currentDate}
          onJobClick={openJob}
          mode="admin"
          showDebug={debug}
          nearestPrevious={rangeDiagnostics.previous?.date ?? null}
          nearestNext={rangeDiagnostics.next?.date ?? null}
          nearestPreviousLabel={
            rangeDiagnostics.previous
              ? `${format(rangeDiagnostics.previous.date, "EEE MMM d")}${
                  rangeDiagnostics.previous.job.scheduledTime
                    ? ` at ${rangeDiagnostics.previous.job.scheduledTime}`
                    : ""
                }`
              : null
          }
          nearestNextLabel={
            rangeDiagnostics.next
              ? `${format(rangeDiagnostics.next.date, "EEE MMM d")}${
                  rangeDiagnostics.next.job.scheduledTime
                    ? ` at ${rangeDiagnostics.next.job.scheduledTime}`
                    : ""
                }`
              : null
          }
          onJumpToDate={jumpTo}
          enableDnd
          onReschedule={handleReschedule}
          onDragBlocked={handleDragBlocked}
        />
      )}

      <Sheet open={!!selectedJob} onOpenChange={(o) => !o && setSelectedJob(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {selectedJob.id}
                  <Badge variant="secondary">{statusLabel(selectedJob.status)}</Badge>
                  {(selectedJob.crew?.length ?? 0) > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Crew ({selectedJob.crew!.length})
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>{selectedJob.customerName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Address:</span> {selectedJob.address}</div>
                  <div><span className="text-muted-foreground">Service:</span> {selectedJob.serviceCategory}</div>
                  <div><span className="text-muted-foreground">Payout:</span> ${selectedJob.payout}</div>
                  <div><span className="text-muted-foreground">Duration:</span> {selectedJob.estimatedDuration}</div>
                </div>

                {debug && (
                  <ScheduleDebugBadge
                    scheduledDate={selectedJob.scheduledDate}
                    scheduledTime={selectedJob.scheduledTime}
                  />
                )}
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Reschedule</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input type="time" step={900} value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveSchedule} disabled={updateJob.isPending}>
                      Save schedule
                    </Button>
                    <Button size="sm" variant="outline" onClick={unschedule} disabled={updateJob.isPending}>
                      Unschedule
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Crew Assignment</h3>
                  <CrewPicker
                    providers={providers}
                    value={sheetCrew}
                    onChange={setSheetCrew}
                    payout={selectedJob.payout}
                    maxHeightClass="max-h-48"
                    helperText="Select one or more SPs. Click ★ to choose the Lead. Clearing all returns the job to Created."
                  />
                  <Button size="sm" onClick={reassign} disabled={assignCrew.isPending}>
                    {assignCrew.isPending ? "Saving..." : "Save assignment"}
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <Link
                    to={`/admin/jobs/${selectedJob.dbId}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open full job <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

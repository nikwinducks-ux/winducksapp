import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, format, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, isWithinInterval, parseISO, compareAsc,
  subDays, subMonths, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useJobs, useServiceProviders, useUpdateJobStatus } from "@/hooks/useSupabaseData";
import { useSpOffers, useAcceptOffer, useDeclineOffer } from "@/hooks/useOfferData";
import {
  useSpUnavailableBlocks,
  useCreateSpUnavailable,
  useUpdateSpUnavailable,
  useDeleteSpUnavailable,
  type SpUnavailableBlock,
} from "@/hooks/useSpUnavailable";
import { useAuth } from "@/contexts/AuthContext";
import { JobCalendar, type CalendarView } from "@/components/calendar/JobCalendar";
import UnavailableDialog, { type UnavailableDialogValue } from "@/components/calendar/UnavailableDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SPVisibilityDiagnostics } from "@/components/sp/SPVisibilityDiagnostics";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { statusLabel } from "@/components/calendar/JobBlock";
import type { Job } from "@/data/mockData";

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SPCalendar() {
  const { user } = useAuth();
  const spId = user?.spId ?? null;

  const { data: jobs = [], isLoading, status: jobsStatus, error: jobsError } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: spOffers = [] } = useSpOffers(spId);
  const { data: unavailableBlocks = [] } = useSpUnavailableBlocks(spId);

  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const updateStatus = useUpdateJobStatus();
  const createBlock = useCreateSpUnavailable();
  const updateBlock = useUpdateSpUnavailable();
  const deleteBlock = useDeleteSpUnavailable();

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<UnavailableDialogValue | null>(null);

  // Pending-offer job ids for this SP
  const pendingOfferJobIds = useMemo(
    () => new Set(spOffers.map((o) => o.job_id)),
    [spOffers]
  );

  // Filter: scheduled + (assigned to me OR on crew OR I have a pending offer)
  const myCalendarJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (j.urgency !== "Scheduled" || !j.scheduledDate) return false;
      if (j.assignedSpId === spId) return true;
      if (j.crew?.some((c) => c.spId === spId)) return true;
      if (pendingOfferJobIds.has(j.dbId)) return true;
      return false;
    });
  }, [jobs, spId, pendingOfferJobIds]);

  const selectedOffer = useMemo(() => {
    if (!selectedJob) return null;
    return spOffers.find((o) => o.job_id === selectedJob.dbId) ?? null;
  }, [selectedJob, spOffers]);

  // Jobs scheduled outside the current visible range — surfaced as chips so SPs
  // never lose sight of work that's just on a different week/day/month.
  const offRangeJobs = useMemo(() => {
    let start: Date, end: Date;
    if (view === "day") { start = currentDate; end = currentDate; }
    else if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return myCalendarJobs
      .filter((j) => {
        if (!j.scheduledDate) return false;
        try {
          const d = parseISO(j.scheduledDate);
          return !isWithinInterval(d, { start, end });
        } catch { return false; }
      })
      .sort((a, b) => compareAsc(parseISO(a.scheduledDate!), parseISO(b.scheduledDate!)));
  }, [myCalendarJobs, view, currentDate]);

  const inRangeCount = myCalendarJobs.length - offRangeJobs.length;

  function jumpToJob(j: Job) {
    if (j.scheduledDate) setCurrentDate(parseISO(j.scheduledDate));
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

  async function handleAccept() {
    if (!selectedOffer) return;
    await acceptOffer.mutateAsync({ offerId: selectedOffer.id });
    setSelectedJob(null);
  }

  async function handleReject() {
    if (!selectedOffer) return;
    await declineOffer.mutateAsync({ offerId: selectedOffer.id, declineReason: "" });
    setSelectedJob(null);
  }

  async function markInProgress() {
    if (!selectedJob || !spId) return;
    await updateStatus.mutateAsync({
      jobDbId: selectedJob.dbId,
      oldStatus: selectedJob.status,
      newStatus: "InProgress",
      spId,
    });
    setSelectedJob(null);
  }

  async function markCompleted() {
    if (!selectedJob || !spId) return;
    await updateStatus.mutateAsync({
      jobDbId: selectedJob.dbId,
      oldStatus: selectedJob.status,
      newStatus: "Completed",
      spId,
    });
    setSelectedJob(null);
  }

  function handleCreateUnavailable(date: Date, start: string, end: string) {
    setDialogInitial({ date: dateToISO(date), start, end, reason: "" });
    setDialogOpen(true);
  }

  function handleClickBlock(block: SpUnavailableBlock) {
    setDialogInitial({
      id: block.id,
      date: block.date,
      start: block.start,
      end: block.end,
      reason: block.reason,
    });
    setDialogOpen(true);
  }

  async function handleDialogSave(v: UnavailableDialogValue) {
    if (!spId) return;
    if (v.id) {
      await updateBlock.mutateAsync({
        id: v.id, spId, date: v.date, start: v.start, end: v.end, reason: v.reason,
      });
    } else {
      await createBlock.mutateAsync({
        spId, date: v.date, start: v.start, end: v.end, reason: v.reason,
      });
    }
    setDialogOpen(false);
    setDialogInitial(null);
  }

  async function handleDialogDelete(id: string) {
    if (!spId) return;
    await deleteBlock.mutateAsync({ id, spId });
    setDialogOpen(false);
    setDialogInitial(null);
  }

  if (!spId) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">Account Not Linked</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your account is not linked to a service provider profile. Contact your administrator.
        </p>
      </div>
    );
  }

  const isPendingOffer = selectedJob ? pendingOfferJobIds.has(selectedJob.dbId) && selectedJob.assignedSpId !== spId : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Your scheduled jobs and pending offers. Drag empty time to mark yourself unavailable.
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

      <SPVisibilityDiagnostics jobs={jobs} context="calendar" />

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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading calendar...</div>
      ) : (
        <JobCalendar
          jobs={myCalendarJobs}
          providers={providers}
          view={view}
          currentDate={currentDate}
          onJobClick={setSelectedJob}
          mode="sp"
          unavailableBlocks={unavailableBlocks}
          onUnavailableClick={handleClickBlock}
          onCreateUnavailable={handleCreateUnavailable}
        />
      )}

      {!isLoading && offRangeJobs.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">
              Other scheduled jobs not in this view
              <span className="ml-2 text-muted-foreground font-normal">({offRangeJobs.length})</span>
            </p>
            {inRangeCount === 0 && (
              <Button size="sm" variant="outline" onClick={() => jumpToJob(offRangeJobs[0])}>
                Jump to next ({format(parseISO(offRangeJobs[0].scheduledDate!), "MMM d")})
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {offRangeJobs.map((j) => (
              <button
                key={j.dbId}
                onClick={() => jumpToJob(j)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-accent transition-colors"
                title={`${j.customerName} · ${j.address}`}
              >
                <span className="font-medium">{j.id}</span>
                <span className="text-muted-foreground">
                  {format(parseISO(j.scheduledDate!), "MMM d")}{j.scheduledTime ? ` · ${j.scheduledTime}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading && myCalendarJobs.length === 0 && (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          No scheduled jobs or pending offers yet.
        </div>
      )}

      <UnavailableDialog
        open={dialogOpen}
        initial={dialogInitial}
        onClose={() => { setDialogOpen(false); setDialogInitial(null); }}
        onSave={handleDialogSave}
        onDelete={handleDialogDelete}
        saving={createBlock.isPending || updateBlock.isPending}
        deleting={deleteBlock.isPending}
      />

      <Sheet open={!!selectedJob} onOpenChange={(o) => !o && setSelectedJob(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedJob.id}
                  <Badge variant="secondary">{statusLabel(selectedJob.status)}</Badge>
                </SheetTitle>
                <SheetDescription>{selectedJob.customerName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Address:</span> {selectedJob.address}</div>
                  <div><span className="text-muted-foreground">Service:</span> {selectedJob.serviceCategory}</div>
                  <div><span className="text-muted-foreground">Payout:</span> ${selectedJob.payout}</div>
                  <div><span className="text-muted-foreground">When:</span> {selectedJob.scheduledDate} {selectedJob.scheduledTime}</div>
                  <div><span className="text-muted-foreground">Duration:</span> {selectedJob.estimatedDuration}</div>
                </div>

                {selectedJob.notes && selectedJob.notes.trim() && (
                  <div className="border-t pt-4 space-y-2">
                    <h3 className="text-sm font-semibold">Job Instructions</h3>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {selectedJob.notes}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  {isPendingOffer && selectedOffer && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAccept}
                        disabled={acceptOffer.isPending}
                        className="flex-1"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReject}
                        disabled={declineOffer.isPending}
                        className="flex-1"
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {!isPendingOffer && (selectedJob.status === "Assigned" || selectedJob.status === "Accepted") && (
                    <Button size="sm" onClick={markInProgress} disabled={updateStatus.isPending} className="w-full">
                      Mark In Progress
                    </Button>
                  )}

                  {!isPendingOffer && selectedJob.status === "InProgress" && (
                    <Button size="sm" onClick={markCompleted} disabled={updateStatus.isPending} className="w-full">
                      Mark Completed
                    </Button>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Link
                    to={isPendingOffer ? `/jobs/${selectedJob.dbId}` : `/sp/jobs/${selectedJob.dbId}`}
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

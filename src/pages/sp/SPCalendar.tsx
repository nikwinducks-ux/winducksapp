import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, format, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, isWithinInterval, parseISO, compareAsc,
  subDays, subMonths, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJobs, useServiceProviders, useSPScheduledVisits } from "@/hooks/useSupabaseData";
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
import AvailabilitySettings from "@/pages/sp/AvailabilitySettings";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { statusLabel } from "@/components/calendar/JobBlock";
import { SPJobDetailContent } from "@/components/sp/SPJobDetailContent";
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

  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: spOffers = [] } = useSpOffers(spId);
  const { data: unavailableBlocks = [] } = useSpUnavailableBlocks(spId);
  const { data: scheduledVisits = [] } = useSPScheduledVisits(spId);

  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  
  const createBlock = useCreateSpUnavailable();
  const updateBlock = useUpdateSpUnavailable();
  const deleteBlock = useDeleteSpUnavailable();

  const isMobile = useIsMobile();
  const [view, setView] = useState<CalendarView | "availability">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [optimisticAcceptedJobId, setOptimisticAcceptedJobId] = useState<string | null>(null);
  // Always read live job from refetched jobs list so the sheet reflects the
  // current status (e.g. "Assigned" right after the SP accepts an offer).
  const selectedJob = useMemo<Job | null>(
    () => (selectedJobId ? jobs.find((j) => j.dbId === selectedJobId) ?? null : null),
    [selectedJobId, jobs]
  );
  const setSelectedJob = (j: Job | null) => setSelectedJobId(j?.dbId ?? null);
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
    setOptimisticAcceptedJobId(selectedOffer.job_id);
    // Keep the sheet open so the SP sees the new "Assigned" status and the
    // "Start Job" CTA without an extra tap.
  }

  async function handleReject() {
    if (!selectedOffer) return;
    await declineOffer.mutateAsync({ offerId: selectedOffer.id, declineReason: "" });
    setOptimisticAcceptedJobId(null);
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

  // An offer is "respondable" if we have a pending offer record for it OR the job
  // is still in an Offered state and isn't already assigned to me. This guards
  // against transient race conditions where the offer record briefly drops out
  // of the pending list (e.g. realtime refresh) but the job is clearly awaiting
  // my response.
  const offerForSelected = useMemo(() => {
    if (!selectedJob) return null;
    return spOffers.find((o) => o.job_id === selectedJob.dbId) ?? null;
  }, [selectedJob, spOffers]);

  // A job is awaiting my response whenever there's a pending offer record for me
  // OR the job is still in the "Offered" state. We intentionally do NOT exclude
  // jobs already preassigned to me — an Offered job needs explicit Accept/Decline
  // before "Start Job" becomes available.
  const isPendingOffer = selectedJob
    ? optimisticAcceptedJobId !== selectedJob.dbId && (pendingOfferJobIds.has(selectedJob.dbId) || selectedJob.status === "Offered")
    : false;
  const selectedJobStatus = selectedJob
    ? (optimisticAcceptedJobId === selectedJob.dbId && selectedJob.status === "Offered" ? "Assigned" : selectedJob.status)
    : null;
  const isSelectedJobAssignedToMe = selectedJob
    ? selectedJob.assignedSpId === spId || optimisticAcceptedJobId === selectedJob.dbId
    : false;
  const me = providers.find((p) => p.id === spId);
  const autoAcceptOn = !!me?.autoAccept;

  const isAvailability = view === "availability";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="hidden sm:block">
          <h1 className="text-2xl font-bold">My Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {isAvailability
              ? "Manage your weekly schedule, time off, and auto-accept rules."
              : "Your scheduled jobs and pending offers. Tap empty time to mark yourself unavailable."}
          </p>
        </div>
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as CalendarView | "availability")}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto overflow-x-auto justify-start sm:justify-center">
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger
              value="availability"
              aria-label="Availability settings"
              title="Availability"
            >
              <Settings className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isAvailability ? (
        <AvailabilitySettings />
      ) : (
        <>
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
              view={view as CalendarView}
              currentDate={currentDate}
              onJobClick={setSelectedJob}
              mode="sp"
              unavailableBlocks={unavailableBlocks}
              onUnavailableClick={handleClickBlock}
              onCreateUnavailable={handleCreateUnavailable}
              onDayClick={(date) => { setCurrentDate(date); setView("day"); }}
              onNavigateWeek={navigate}
              onDateChange={setCurrentDate}
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
        </>
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
                  <Badge variant="secondary">{statusLabel((selectedJobStatus ?? selectedJob.status) as Job["status"])}</Badge>
                </SheetTitle>
                <SheetDescription>{selectedJob.customerName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                {/* Calendar-only: Offer response affordances (not present on My Jobs page) */}
                {isPendingOffer && offerForSelected && (
                  <div className="rounded-md border bg-card p-3 space-y-3">
                    <h3 className="text-sm font-semibold">Respond to Offer</h3>
                    {autoAcceptOn && (
                      <p className="text-xs text-muted-foreground">
                        Auto-Accept is ON — offers are usually handled automatically. You can still
                        respond manually below, or{" "}
                        <Link to="/auto-accept" className="text-primary hover:underline">
                          turn it off
                        </Link>
                        .
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="lg"
                        onClick={handleAccept}
                        disabled={acceptOffer.isPending}
                        className="flex-1"
                      >
                        {acceptOffer.isPending ? "Accepting..." : "Accept"}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleReject}
                        disabled={declineOffer.isPending}
                        className="flex-1"
                      >
                        {declineOffer.isPending ? "Declining..." : "Decline"}
                      </Button>
                    </div>
                  </div>
                )}

                {isPendingOffer && !offerForSelected && (
                  <div className="rounded-md border border-muted bg-muted/30 p-3 space-y-1.5">
                    <h3 className="text-sm font-semibold">Offer no longer available</h3>
                    <p className="text-xs text-muted-foreground">
                      This offer may have expired, been withdrawn, or already been responded to.
                      Check{" "}
                      <Link to="/jobs" className="text-primary hover:underline">
                        Job Offers
                      </Link>{" "}
                      for current opportunities.
                    </p>
                  </div>
                )}

                {/* Reuse the My Jobs detail layout exactly */}
                <SPJobDetailContent job={selectedJob} variant="panel" hideHeader />

                <div className="border-t pt-4">
                  <Link
                    to={isPendingOffer ? `/jobs/${selectedJob.dbId}` : `/sp/jobs/${selectedJob.dbId}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open full page <ExternalLink className="h-3 w-3" />
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

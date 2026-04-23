import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, format, startOfWeek, endOfWeek,
  subDays, subMonths, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useJobs, useServiceProviders, useUpdateJobStatus } from "@/hooks/useSupabaseData";
import { useSpOffers, useAcceptOffer, useDeclineOffer } from "@/hooks/useOfferData";
import { useAuth } from "@/contexts/AuthContext";
import { JobCalendar, type CalendarView } from "@/components/calendar/JobCalendar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { statusLabel } from "@/components/calendar/JobBlock";
import type { Job } from "@/data/mockData";

export default function SPCalendar() {
  const { user } = useAuth();
  const spId = user?.spId ?? null;

  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: spOffers = [] } = useSpOffers(spId);

  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const updateStatus = useUpdateJobStatus();

  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

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
            Your scheduled jobs and pending offers.
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
        />
      )}

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

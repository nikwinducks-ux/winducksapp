import { useState } from "react";
import { useJobs, useServiceProvider, useSPInvoices, useReopenJob } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { JobServicesSummary } from "@/components/JobServicesDisplay";

import { CrewTeammates } from "@/components/sp/CrewTeammates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, DollarSign, Calendar, FileText, Users, RotateCcw, CalendarPlus } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import ScheduledVisitDialog, { type ScheduledVisitValue } from "@/components/sp/ScheduledVisitDialog";
import { useCreateScheduledVisit } from "@/hooks/useSupabaseData";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Job } from "@/data/mockData";

function ScheduleText({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <span>ASAP</span>;
  if (urgency === "AnytimeSoon") return <span>Flexible</span>;
  return <span>{job.scheduledDate || "TBD"}</span>;
}

export default function MyJobs() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();
  const { data: sp } = useServiceProvider(user?.spId);
  const { data: invoices = [] } = useSPInvoices(user?.spId ? { spId: user.spId } : undefined);
  const invoiceByJob = new Map(invoices.map((inv) => [inv.jobId, inv]));
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "past" ? "past" : "active";

  const myJobs = jobs.filter(
    (j) => j.assignedSpId === user?.spId || j.crew?.some((c) => c.spId === user?.spId)
  );
  const activeJobs = myJobs
    .filter((j) => !["Completed", "Cancelled"].includes(j.status))
    .sort((a, b) => {
      if (a.scheduledDate && b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);
      if (a.scheduledDate) return -1;
      if (b.scheduledDate) return 1;
      return 0;
    });
  const pastJobs = myJobs
    .filter((j) => j.status === "Completed")
    .sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading jobs...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">My Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logged in as <span className="font-medium text-foreground">{sp?.name ?? user?.email ?? "—"}</span> · {activeJobs.length} active, {pastJobs.length} past
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "active") next.delete("tab");
          else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="active">Active ({activeJobs.length})</TabsTrigger>
          <TabsTrigger value="past">Past Jobs ({pastJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {activeJobs.length === 0 ? (
            <div className="metric-card text-center py-10">
              <p className="text-muted-foreground">No active jobs.</p>
            </div>
          ) : (
            activeJobs.map((job) => {
              const crewSize = job.crew?.length ?? 0;
              const isCrew = crewSize > 1;
              const displayPayout = isCrew ? (job.payoutShare ?? job.payout) : job.payout;
              return (
                <Link key={job.id} to={`/sp/jobs/${job.dbId}`} className="block">
                  <div className="metric-card space-y-2 hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{job.id}</p>
                        <StatusBadge label={job.status === "InProgress" ? "In Progress" : job.status} variant={job.status === "InProgress" ? "warning" : "info"} />
                        <UrgencyBadge urgency={job.urgency} />
                        {isCrew && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            <Users className="h-3 w-3" /> Crew ({crewSize})
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold text-primary flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />{displayPayout.toFixed(2)}
                        {isCrew && <span className="text-[10px] font-normal text-muted-foreground ml-1">your share</span>}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{job.customerName} — {job.services && job.services.length > 0 ? <JobServicesSummary services={job.services} /> : job.serviceCategory}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.address}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /><ScheduleText job={job} /></span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.estimatedDuration || "—"}</span>
                    </div>
                    {isCrew && (
                      <CrewTeammates jobId={job.dbId} excludeSpId={user?.spId} variant="inline" />
                    )}
                    {job.notes && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="truncate">{job.notes.slice(0, 120)}{job.notes.length > 120 ? "..." : ""}</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-3">
          {pastJobs.length === 0 ? (
            <div className="metric-card text-center py-10">
              <p className="text-muted-foreground">No completed jobs yet.</p>
            </div>
          ) : (
            pastJobs.map((job) => {
              const inv = invoiceByJob.get(job.dbId);
              const paid = inv?.status === "Paid";
              return (
                <PastJobCard
                  key={job.id}
                  job={job}
                  inv={inv}
                  paid={paid}
                />
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PastJobCard({ job, inv, paid }: { job: Job; inv: any; paid: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reopen = useReopenJob();
  const createVisit = useCreateScheduledVisit();
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);

  const isMine = user?.spId
    ? job.assignedSpId === user.spId || (job.crew ?? []).some((c) => c.spId === user.spId)
    : false;

  function go() { navigate(`/sp/jobs/${job.dbId}`); }

  async function handleSaveVisit(v: ScheduledVisitValue) {
    if (!user?.spId) return;
    await createVisit.mutateAsync({
      jobId: job.dbId, spId: user.spId, userId: user.id,
      visitDate: v.visitDate, startTime: v.startTime,
      durationMin: v.durationMin, note: v.note,
    });
    setVisitOpen(false);
  }

  function doReopen() {
    if (!user?.spId) return;
    reopen.mutate(
      { jobDbId: job.dbId, spId: user.spId, oldStatus: job.status },
      { onSuccess: () => setConfirmReopen(false) },
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }}
        className="metric-card opacity-90 hover:border-primary/30 transition-colors cursor-pointer space-y-3"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{job.id}</p>
              <StatusBadge label={job.status} variant="valid" />
              <UrgencyBadge urgency={job.urgency} />
              {inv && (
                <StatusBadge
                  label={paid ? "Paid" : "Unpaid"}
                  variant={paid ? "valid" : "warning"}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {job.customerName} · {job.services && job.services.length > 0 ? job.services.map(s => s.service_category).join(", ") : job.serviceCategory} · {job.scheduledDate || "—"}
            </p>
            {paid && inv?.paidAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Paid {new Date(inv.paidAt).toLocaleDateString()}
                {inv.paymentMethod ? ` · ${inv.paymentMethod}` : ""}
              </p>
            )}
          </div>
          <p className="text-lg font-bold">${(inv?.netAmount ?? job.payout).toFixed(2)}</p>
        </div>

        {isMine && (
          <div
            className="flex flex-wrap gap-2 pt-2 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setVisitOpen(true); }}
            >
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Schedule visit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setConfirmReopen(true); }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Re-open job
            </Button>
          </div>
        )}
      </div>

      <ScheduledVisitDialog
        open={visitOpen}
        initial={null}
        jobLabel={`${job.id} · ${job.customerName}`}
        saving={createVisit.isPending}
        onClose={() => setVisitOpen(false)}
        onSave={handleSaveVisit}
      />

      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-open {job.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              The job will move back to your Active jobs as <strong>Assigned</strong>. Existing
              invoices and payment status are not changed automatically — contact your admin if
              billing needs to be adjusted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doReopen} disabled={reopen.isPending}>
              {reopen.isPending ? "Re-opening..." : "Re-open job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useJobs, useServiceProvider } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { JobServicesSummary } from "@/components/JobServicesDisplay";
import { SPVisibilityDiagnostics } from "@/components/sp/SPVisibilityDiagnostics";
import { CrewTeammates } from "@/components/sp/CrewTeammates";
import { MapPin, Clock, DollarSign, Calendar, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";

function ScheduleText({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <span>ASAP</span>;
  if (urgency === "AnytimeSoon") return <span>Flexible</span>;
  return <span>{job.scheduledDate || "TBD"}</span>;
}

export default function MyJobs() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading, status: jobsStatus, error: jobsError } = useJobs();
  const { data: sp } = useServiceProvider(user?.spId);

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
  const pastJobs = myJobs.filter((j) => ["Completed", "Cancelled"].includes(j.status));

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading jobs...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">My Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logged in as <span className="font-medium text-foreground">{sp?.name ?? user?.email ?? "—"}</span> · {activeJobs.length} active, {pastJobs.length} past
        </p>
      </div>

      <SPVisibilityDiagnostics
        jobs={jobs}
        context="my-jobs"
        queryState={jobsStatus as any}
        queryError={jobsError ? (jobsError as any).message ?? String(jobsError) : null}
      />

      {activeJobs.length === 0 && pastJobs.length === 0 && (
        <div className="metric-card text-center py-10">
          <p className="text-muted-foreground">No jobs assigned to you yet.</p>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Active Jobs</h2>
          <div className="space-y-3">
            {activeJobs.map((job) => {
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
            })}
          </div>
        </div>
      )}

      {pastJobs.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Past Jobs</h2>
          <div className="space-y-3">
            {pastJobs.map((job) => (
              <Link key={job.id} to={`/sp/jobs/${job.dbId}`} className="block">
                <div className="metric-card opacity-80 flex items-center gap-4 hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{job.id}</p>
                      <StatusBadge label={job.status} variant={job.status === "Completed" ? "valid" : "warning"} />
                      <UrgencyBadge urgency={job.urgency} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{job.customerName} · {job.services && job.services.length > 0 ? job.services.map(s => s.service_category).join(", ") : job.serviceCategory} · {job.scheduledDate}</p>
                  </div>
                  <p className="text-lg font-bold">${job.payout}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

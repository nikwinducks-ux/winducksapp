import { useServiceProviders, useJobs, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { MapPin, Clock, DollarSign, FileText } from "lucide-react";
import { haversineDistance } from "@/lib/proximity";

function UrgencyBadge({ urgency }: { urgency?: string }) {
  if (!urgency || urgency === "Scheduled") return <StatusBadge label="Scheduled" variant="info" />;
  if (urgency === "ASAP") return <StatusBadge label="ASAP" variant="error" />;
  return <StatusBadge label="Anytime soon" variant="warning" />;
}

function ScheduleText({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <span>ASAP — dispatch ASAP</span>;
  if (urgency === "AnytimeSoon") return <span>Anytime soon — flexible</span>;
  return <span>{job.scheduledDate} · {job.scheduledTime}</span>;
}

export default function JobOffers() {
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const activeCategories = useActiveServiceCategories();
  const sp = serviceProviders[0];

  const pendingJobs = jobs.filter((j) => j.status === "pending" || j.status === "created");
  const otherJobs = jobs.filter((j) => j.status !== "pending" && j.status !== "created");

  function getDistanceDisplay(job: typeof jobs[0]) {
    if (sp?.baseAddress.lat && sp?.baseAddress.lng && job.jobAddress.lat && job.jobAddress.lng) {
      return `${haversineDistance(sp.baseAddress.lat, sp.baseAddress.lng, job.jobAddress.lat, job.jobAddress.lng)} km`;
    }
    return "N/A";
  }

  const isLegacy = (cat: string) => activeCategories.length > 0 && !activeCategories.some((c) => c.name === cat);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Job Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{pendingJobs.length} pending offers</p>
      </div>

      <div>
        <h2 className="section-title mb-4">Pending Offers</h2>
        <div className="space-y-3">
          {pendingJobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="metric-card flex items-center gap-4 hover:border-primary/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{job.customerName}</p>
                  <StatusBadge label={isLegacy(job.serviceCategory) ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory} variant="neutral" />
                  <UrgencyBadge urgency={job.urgency} />
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{job.address}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{getDistanceDisplay(job)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.estimatedDuration}</span>
                  <span><ScheduleText job={job} /></span>
                </div>
                {job.notes && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                    <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="truncate">{job.notes.slice(0, 120)}{job.notes.length > 120 ? "..." : ""}</span>
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-primary flex items-center gap-1"><DollarSign className="h-4 w-4" />{job.payout}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="section-title mb-4">Past & Assigned Jobs</h2>
        <div className="space-y-3">
          {otherJobs.map((job) => {
            const variant = job.status === "assigned" ? "info" : job.status === "completed" ? "valid" : job.status === "expired" || job.status === "cancelled" ? "warning" : job.status === "in-progress" ? "info" : "error";
            return (
              <div key={job.id} className="metric-card flex items-center gap-4 opacity-80">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{job.customerName}</p>
                    <StatusBadge label={job.status} variant={variant} />
                    <UrgencyBadge urgency={job.urgency} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{job.serviceCategory} · {job.scheduledDate}</p>
                </div>
                <p className="text-lg font-bold">${job.payout}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

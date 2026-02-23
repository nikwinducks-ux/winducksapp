import { useServiceProviders, useJobs, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { useSpOffers, useExpireStaleOffers, type Offer } from "@/hooks/useOfferData";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { MapPin, Clock, DollarSign, FileText, Timer } from "lucide-react";
import { computeProximityResult } from "@/lib/proximity";
import { useEffect, useMemo } from "react";

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
  const { user } = useAuth();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const activeCategories = useActiveServiceCategories();
  const { data: pendingOffers = [], refetch } = useSpOffers(user?.spId);
  const expireStale = useExpireStaleOffers();

  const currentSp = serviceProviders.find(sp => sp.id === user?.spId);

  // Expire stale offers
  useEffect(() => {
    expireStale.mutate();
  }, []);

  // Refresh periodically
  useEffect(() => {
    const iv = setInterval(() => {
      refetch();
      expireStale.mutate();
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // Map offers to jobs
  const offerJobs = useMemo(() => {
    return pendingOffers
      .filter(o => new Date(o.expires_at) > new Date()) // Not expired
      .map(offer => {
        const job = jobs.find(j => j.dbId === offer.job_id);
        return job ? { offer, job } : null;
      })
      .filter(Boolean) as { offer: Offer; job: typeof jobs[0] }[];
  }, [pendingOffers, jobs]);

  // Past jobs assigned to this SP
  const myAssignedJobs = jobs.filter(j => j.assignedSpId === user?.spId);

  function getDistanceDisplay(job: typeof jobs[0]) {
    if (!currentSp) return "N/A";
    const result = computeProximityResult(currentSp.baseAddress, job.jobAddress);
    if (result.distanceKm !== null) return `${result.distanceKm} km`;
    return "N/A";
  }

  const isLegacy = (cat: string) => activeCategories.length > 0 && !activeCategories.some((c) => c.name === cat);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Job Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{offerJobs.length} pending offer{offerJobs.length !== 1 ? "s" : ""}</p>
      </div>

      <div>
        <h2 className="section-title mb-4">Pending Offers</h2>
        {offerJobs.length === 0 ? (
          <div className="metric-card text-center py-8">
            <p className="text-muted-foreground">No pending offers right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {offerJobs.map(({ offer, job }) => {
              const minutesLeft = Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 60000));
              return (
                <Link key={offer.id} to={`/jobs/${job.dbId}?offer=${offer.id}`} className="metric-card flex items-center gap-4 hover:border-primary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{job.customerName}</p>
                      <StatusBadge label={isLegacy(job.serviceCategory) ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory} variant="neutral" />
                      <UrgencyBadge urgency={job.urgency} />
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="h-3 w-3" /> {minutesLeft}m left
                      </span>
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
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="section-title mb-4">Past & Assigned Jobs</h2>
        <div className="space-y-3">
          {myAssignedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past jobs yet.</p>
          ) : (
            myAssignedJobs.map((job) => {
              const variant = job.status === "assigned" ? "info" : job.status === "completed" ? "valid" : job.status === "expired" || job.status === "cancelled" ? "warning" : job.status === "in-progress" ? "info" : "error";
              return (
                <div key={job.dbId} className="metric-card flex items-center gap-4 opacity-80">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{job.customerName}</p>
                      <StatusBadge label={job.status} variant={variant} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{job.serviceCategory} · {job.scheduledDate}</p>
                  </div>
                  <p className="text-lg font-bold">${job.payout}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

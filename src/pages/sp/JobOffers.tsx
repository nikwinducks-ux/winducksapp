import { jobs } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { MapPin, Clock, DollarSign } from "lucide-react";

export default function JobOffers() {
  const pendingJobs = jobs.filter((j) => j.status === "pending");
  const otherJobs = jobs.filter((j) => j.status !== "pending");

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
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="metric-card flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{job.customerName}</p>
                  <StatusBadge label={job.serviceCategory} variant="neutral" />
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{job.address}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.distance} km</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.estimatedDuration}</span>
                  <span>{job.scheduledDate} · {job.scheduledTime}</span>
                </div>
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
            const variant = job.status === "assigned" ? "info" : job.status === "completed" ? "valid" : job.status === "expired" ? "warning" : job.status === "in-progress" ? "info" : "error";
            return (
              <div key={job.id} className="metric-card flex items-center gap-4 opacity-80">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{job.customerName}</p>
                    <StatusBadge label={job.status} variant={variant} />
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

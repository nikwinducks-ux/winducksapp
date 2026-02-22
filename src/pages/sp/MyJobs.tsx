import { useJobs } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin, Clock, DollarSign, Calendar } from "lucide-react";

export default function MyJobs() {
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();

  const myJobs = jobs.filter((j) => j.assignedSpId === user?.spId);
  const activeJobs = myJobs.filter((j) => j.status !== "completed" && j.status !== "cancelled");
  const pastJobs = myJobs.filter((j) => j.status === "completed" || j.status === "cancelled");

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading jobs...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">My Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">{activeJobs.length} active, {pastJobs.length} past</p>
      </div>

      {activeJobs.length === 0 && pastJobs.length === 0 && (
        <div className="metric-card text-center py-10">
          <p className="text-muted-foreground">No jobs assigned to you yet.</p>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Active Jobs</h2>
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div key={job.id} className="metric-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{job.id}</p>
                    <StatusBadge label={job.status} variant="info" />
                  </div>
                  <p className="text-xl font-bold text-primary flex items-center gap-1"><DollarSign className="h-4 w-4" />{job.payout}</p>
                </div>
                <p className="text-sm font-medium">{job.customerName} — {job.serviceCategory}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.address}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{job.scheduledDate || "TBD"}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.estimatedDuration || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastJobs.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Past Jobs</h2>
          <div className="space-y-3">
            {pastJobs.map((job) => (
              <div key={job.id} className="metric-card opacity-80 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{job.customerName}</p>
                    <StatusBadge label={job.status} variant={job.status === "completed" ? "valid" : "warning"} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{job.serviceCategory} · {job.scheduledDate}</p>
                </div>
                <p className="text-lg font-bold">${job.payout}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

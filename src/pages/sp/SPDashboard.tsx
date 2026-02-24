import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useServiceProviders, useJobs } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { haversineDistance } from "@/lib/proximity";
import { Briefcase, Clock, Star, TrendingUp, Shield, Scale } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function SPDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();

  // Use logged-in SP, fallback to first SP
  const sp = serviceProviders.find((s) => s.id === user?.spId) ?? serviceProviders[0];
  if (!sp) return <div className="py-20 text-center text-muted-foreground">Loading dashboard...</div>;

  const assignedJobs = jobs.filter((j) => j.assignedSpId === sp.id && (j.status === "Assigned" || j.status === "InProgress"));
  const pendingOffers = jobs.filter((j) => j.status === "Created" || j.status === "Offered").slice(0, 3);

  const complianceVariant = sp.complianceStatus === "Valid" ? "valid" : sp.complianceStatus === "Expiring" ? "warning" : "error";
  const fairnessVariant = sp.fairnessStatus === "Within Target" ? "valid" : sp.fairnessStatus === "Above Target Share" ? "warning" : "info";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Welcome back, {sp.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your overview for today</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Today's Assigned Jobs" value={assignedJobs.length} icon={<Briefcase className="h-5 w-5" />} to="/my-jobs" />
        <MetricCard label="Pending Offers" value={pendingOffers.length} icon={<Clock className="h-5 w-5" />} to="/jobs" />
        <MetricCard label="Acceptance Rate" value={`${sp.acceptanceRate}%`} icon={<TrendingUp className="h-5 w-5" />} subtitle="Last 30 days" to="/performance" />
        <MetricCard label="Avg Rating" value={sp.rating.toFixed(1)} icon={<Star className="h-5 w-5" />} subtitle={`${sp.totalJobsCompleted} jobs completed`} to="/performance" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" role="button" tabIndex={0} onClick={() => navigate("/performance")} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/performance")}>
          <p className="text-sm text-muted-foreground mb-2">Reliability Score</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{sp.reliabilityScore}</span>
            <div className="flex-1 score-bar-track"><div className="score-bar" style={{ width: `${sp.reliabilityScore}%` }} /></div>
          </div>
        </div>
        <div className="metric-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" role="button" tabIndex={0} onClick={() => navigate("/performance")} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/performance")}>
          <p className="text-sm text-muted-foreground mb-2">Fairness Status</p>
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <StatusBadge label={sp.fairnessStatus} variant={fairnessVariant} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Share: {sp.fairnessShare}% (last 30 days)</p>
        </div>
        <div className="metric-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" role="button" tabIndex={0} onClick={() => navigate("/account")} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/account")}>
          <p className="text-sm text-muted-foreground mb-2">Compliance Status</p>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <StatusBadge label={sp.complianceStatus} variant={complianceVariant} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Insurance expires: {sp.insuranceExpiry}</p>
        </div>
      </div>

      <div>
        <h2 className="section-title mb-4">Today's Assigned Jobs</h2>
        {assignedJobs.length === 0 ? (
          <div className="metric-card text-center text-muted-foreground py-8">No jobs assigned today</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {assignedJobs.map((job) => (
              <Link key={job.id} to={`/my-jobs/${job.id}`} className="metric-card hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{job.customerName}</p>
                    <p className="text-sm text-muted-foreground">{job.address}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{job.serviceCategory} · {job.estimatedDuration}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">${job.payout}</p>
                    <p className="text-xs text-muted-foreground">{job.scheduledTime}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Pending Job Offers</h2>
          <Link to="/jobs" className="text-sm font-medium text-primary hover:underline">View All</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendingOffers.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="metric-card hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{job.customerName}</p>
                  <p className="text-sm text-muted-foreground">{job.serviceCategory}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{job.scheduledDate} · {job.scheduledTime}</p>
                </div>
                <p className="text-lg font-bold text-primary">${job.payout}</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{(() => {
                  if (sp?.baseAddress.lat && sp?.baseAddress.lng && job.jobAddress.lat && job.jobAddress.lng) {
                    return `${haversineDistance(sp.baseAddress.lat, sp.baseAddress.lng, job.jobAddress.lat, job.jobAddress.lng)} km away`;
                  }
                  return "Distance N/A";
                })()}</span>
                <span>·</span>
                <span>{job.estimatedDuration}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

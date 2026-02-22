import { MetricCard } from "@/components/MetricCard";
import { useServiceProviders, useJobs } from "@/hooks/useSupabaseData";
import { Users, Briefcase, TrendingUp, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();

  const activeSPs = serviceProviders.filter((s) => s.status === "Active").length;
  const pendingJobs = jobs.filter((j) => j.status === "pending" || j.status === "created").length;
  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const expiring = serviceProviders.filter((s) => s.complianceStatus === "Expiring").length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">System overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Providers" value={activeSPs} icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Pending Jobs" value={pendingJobs} icon={<Briefcase className="h-5 w-5" />} />
        <MetricCard label="Completed (Total)" value={completedJobs} icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Expiring Compliance" value={expiring} icon={<AlertTriangle className="h-5 w-5" />} subtitle={expiring > 0 ? "Needs attention" : "All clear"} trend={expiring > 0 ? "down" : "up"} />
      </div>

      <div className="metric-card">
        <h2 className="section-title mb-4">Provider Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground">Name</th>
                <th className="pb-3 font-medium text-muted-foreground">Rating</th>
                <th className="pb-3 font-medium text-muted-foreground">Reliability</th>
                <th className="pb-3 font-medium text-muted-foreground">Fairness</th>
                <th className="pb-3 font-medium text-muted-foreground">Compliance</th>
                <th className="pb-3 font-medium text-muted-foreground">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {serviceProviders.map((sp) => (
                <tr key={sp.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{sp.name}</td>
                  <td className="py-3">{sp.rating}</td>
                  <td className="py-3">{sp.reliabilityScore}</td>
                  <td className="py-3">
                    <span className={`status-badge ${
                      sp.fairnessStatus === "Within Target" ? "status-valid" :
                      sp.fairnessStatus === "Above Target Share" ? "status-warning" : "bg-info/10 text-info"
                    }`}>{sp.fairnessStatus}</span>
                  </td>
                  <td className="py-3">
                    <span className={`status-badge ${
                      sp.complianceStatus === "Valid" ? "status-valid" :
                      sp.complianceStatus === "Expiring" ? "status-warning" : "status-error"
                    }`}>{sp.complianceStatus}</span>
                  </td>
                  <td className="py-3">{sp.totalJobsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

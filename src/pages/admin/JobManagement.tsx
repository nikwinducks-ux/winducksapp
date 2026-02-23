import { useState } from "react";
import { useJobs, useServiceProviders } from "@/hooks/useSupabaseData";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, Pencil, UserPlus, Archive } from "lucide-react";
import { Link } from "react-router-dom";

export default function JobManagement() {
  const [search, setSearch] = useState("");
  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();

  const spMap = new Map(providers.map((sp) => [sp.id, sp.name]));

  const filtered = jobs.filter(
    (j) =>
      j.status !== "cancelled" &&
      (j.id.toLowerCase().includes(search.toLowerCase()) ||
        j.customerName.toLowerCase().includes(search.toLowerCase()) ||
        j.serviceCategory.toLowerCase().includes(search.toLowerCase()) ||
        j.jobAddress.city.toLowerCase().includes(search.toLowerCase()))
  );

  const statusVariant = (s: string) => {
    switch (s) {
      case "assigned": return "info";
      case "completed": return "valid";
      case "cancelled": case "expired": return "warning";
      case "created": case "pending": return "neutral";
      default: return "neutral";
    }
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading jobs...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} jobs</p>
        </div>
        <Link to="/admin/jobs/new">
          <Button><Plus className="h-4 w-4 mr-2" />Create Job</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search job #, customer, type, city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-muted-foreground">Job #</th>
              <th className="pb-3 font-medium text-muted-foreground">Customer</th>
              <th className="pb-3 font-medium text-muted-foreground">Service</th>
              <th className="pb-3 font-medium text-muted-foreground">Amount</th>
              <th className="pb-3 font-medium text-muted-foreground">City</th>
              <th className="pb-3 font-medium text-muted-foreground">Status</th>
              <th className="pb-3 font-medium text-muted-foreground">Assigned SP</th>
              <th className="pb-3 font-medium text-muted-foreground">Created</th>
              <th className="pb-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{job.id}</td>
                <td className="py-3">{job.customerName}</td>
                <td className="py-3">{job.serviceCategory}</td>
                <td className="py-3 font-medium">${job.payout}</td>
                <td className="py-3 text-muted-foreground">{job.jobAddress.city}</td>
                <td className="py-3">
                  <StatusBadge label={job.status} variant={statusVariant(job.status) as any} />
                </td>
                <td className="py-3 text-muted-foreground">
                  {job.assignedSpId ? spMap.get(job.assignedSpId) ?? "—" : "—"}
                </td>
                <td className="py-3 text-muted-foreground">{job.scheduledDate}</td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/jobs/${job.dbId}`}>
                      <Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/admin/jobs/${job.dbId}/edit`}>
                      <Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/admin/jobs/${job.dbId}?assign=true`}>
                      <Button size="sm" variant="ghost" title="Assign SP"><UserPlus className="h-4 w-4" /></Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
